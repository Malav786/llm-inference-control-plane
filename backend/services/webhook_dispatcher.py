import hmac
import hashlib
import json
import time
import asyncio
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
import httpx
from backend.config import settings

logger = logging.getLogger("webhook_dispatcher")

@dataclass
class WebhookSubscription:
    id: str
    target_url: str
    secret: str
    events: List[str]  # e.g., ["request.preempted", "request.completed", "kv.capacity_warning"]
    created_at: float = field(default_factory=time.time)
    active: bool = True

@dataclass
class WebhookDeliveryLog:
    id: str
    subscription_id: str
    target_url: str
    event: str
    status_code: Optional[int]
    success: bool
    attempt: int
    duration_ms: float
    timestamp: float = field(default_factory=time.time)
    error_message: Optional[str] = None

class WebhookDispatcher:
    def __init__(self) -> None:
        self.subscriptions: Dict[str, WebhookSubscription] = {}
        self.logs: List[WebhookDeliveryLog] = []
        self._log_counter = 0

    def register(self, subscription_id: str, target_url: str, secret: str, events: Optional[List[str]] = None) -> WebhookSubscription:
        if events is None:
            events = ["request.preempted", "request.completed", "kv.capacity_warning", "sla.ttft_violation"]
        sub = WebhookSubscription(
            id=subscription_id,
            target_url=target_url,
            secret=secret,
            events=events
        )
        self.subscriptions[subscription_id] = sub
        logger.info(f"Registered webhook subscription {subscription_id} -> {target_url}")
        return sub

    def unregister(self, subscription_id: str) -> bool:
        if subscription_id in self.subscriptions:
            del self.subscriptions[subscription_id]
            return True
        return False

    def list_subscriptions(self) -> List[Dict[str, Any]]:
        return [asdict(sub) for sub in self.subscriptions.values()]

    def list_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [asdict(log) for log in reversed(self.logs[-limit:])]

    def generate_signature(self, secret: str, payload_bytes: bytes) -> str:
        return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

    async def dispatch_event(self, event_name: str, payload: Dict[str, Any]) -> None:
        matching_subs = [
            sub for sub in self.subscriptions.values()
            if sub.active and (event_name in sub.events or "*" in sub.events)
        ]
        if not matching_subs:
            return

        body_data = {
            "event": event_name,
            "timestamp": time.time(),
            "data": payload
        }
        json_bytes = json.dumps(body_data).encode("utf-8")

        for sub in matching_subs:
            asyncio.create_task(self._send_with_retry(sub, event_name, json_bytes))

    async def _send_with_retry(self, sub: WebhookSubscription, event_name: str, json_bytes: bytes) -> bool:
        signature = self.generate_signature(sub.secret, json_bytes)
        headers = {
            "Content-Type": "application/json",
            "X-Signature-SHA256": signature,
            "X-Event-Type": event_name,
            "User-Agent": "LLM-Inference-Control-Plane/1.0"
        }

        self._log_counter += 1
        log_id = f"wh_log_{self._log_counter}"
        
        async with httpx.AsyncClient(timeout=settings.WEBHOOK_TIMEOUT_SECONDS) as client:
            for attempt in range(1, settings.WEBHOOK_MAX_RETRIES + 1):
                start_time = time.time()
                try:
                    resp = await client.post(sub.target_url, content=json_bytes, headers=headers)
                    duration_ms = (time.time() - start_time) * 1000.0
                    success = (200 <= resp.status_code < 300)
                    
                    log = WebhookDeliveryLog(
                        id=log_id,
                        subscription_id=sub.id,
                        target_url=sub.target_url,
                        event=event_name,
                        status_code=resp.status_code,
                        success=success,
                        attempt=attempt,
                        duration_ms=round(duration_ms, 2)
                    )
                    self.logs.append(log)
                    
                    if success:
                        logger.info(f"Webhook {event_name} delivered to {sub.target_url} (HTTP {resp.status_code})")
                        return True
                except Exception as e:
                    duration_ms = (time.time() - start_time) * 1000.0
                    log = WebhookDeliveryLog(
                        id=log_id,
                        subscription_id=sub.id,
                        target_url=sub.target_url,
                        event=event_name,
                        status_code=None,
                        success=False,
                        attempt=attempt,
                        duration_ms=round(duration_ms, 2),
                        error_message=str(e)
                    )
                    self.logs.append(log)
                
                # Backoff before retry
                if attempt < settings.WEBHOOK_MAX_RETRIES:
                    await asyncio.sleep(0.5 * attempt)
        
        return False

# Global instance
webhook_dispatcher = WebhookDispatcher()
