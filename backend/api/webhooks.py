from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Dict, Any
import uuid
import time
import json
import httpx
from backend.services.webhook_dispatcher import webhook_dispatcher
from backend.middleware.security import verify_api_key

router = APIRouter(prefix="/webhooks", tags=["Webhooks Platform"])

class WebhookRegisterRequest(BaseModel):
    target_url: str = Field(..., example="https://webhook.site/your-unique-id")
    secret: Optional[str] = Field(None, example="whsec_secret_key_12345")
    events: Optional[List[str]] = Field(
        ["request.preempted", "request.completed", "kv.capacity_warning", "sla.ttft_violation"],
        example=["request.preempted", "request.completed"]
    )

class WebhookTestTriggerPayload(BaseModel):
    target_url: str = Field(..., example="https://webhook.site/your-unique-id")
    secret: Optional[str] = Field("whsec_demo_secret", example="whsec_demo_secret")
    event: Optional[str] = Field("request.preempted", example="request.preempted")

@router.post("/register")
def register_webhook(payload: WebhookRegisterRequest, api_key: str = Depends(verify_api_key)) -> Dict[str, Any]:
    """Register a target webhook URL to receive signed HMAC events."""
    sub_id = f"sub_{uuid.uuid4().hex[:8]}"
    secret = payload.secret or f"whsec_{uuid.uuid4().hex[:16]}"
    sub = webhook_dispatcher.register(
        subscription_id=sub_id,
        target_url=payload.target_url,
        secret=secret,
        events=payload.events
    )
    return {
        "status": "registered",
        "subscription_id": sub.id,
        "target_url": sub.target_url,
        "secret": sub.secret,
        "events": sub.events
    }

@router.get("")
def list_webhooks(api_key: str = Depends(verify_api_key)) -> Dict[str, Any]:
    """List all registered webhook subscriptions."""
    return {
        "subscriptions": webhook_dispatcher.list_subscriptions()
    }

@router.delete("/{subscription_id}")
def delete_webhook(subscription_id: str, api_key: str = Depends(verify_api_key)) -> Dict[str, Any]:
    """Unregister a webhook subscription by ID."""
    success = webhook_dispatcher.unregister(subscription_id)
    if not success:
        raise HTTPException(status_code=404, detail="Webhook subscription not found")
    return {"status": "unregistered", "subscription_id": subscription_id}

@router.post("/test")
async def test_webhook(payload: WebhookTestTriggerPayload, api_key: str = Depends(verify_api_key)) -> Dict[str, Any]:
    """Trigger a live test webhook event to verify URL receipt & HMAC-SHA256 signature."""
    sample_data = {
        "event": payload.event,
        "test": True,
        "message": "Live HMAC-SHA256 Signed Webhook Test Payload",
        "sample_preemption": {
            "preempted_ids": ["REQ-BATCH-LOW-1"],
            "reclaimed_kv_blocks": 8,
            "timestamp": time.time()
        }
    }
    
    json_bytes = json.dumps(sample_data).encode("utf-8")
    secret = payload.secret or "whsec_test_secret"
    signature = webhook_dispatcher.generate_signature(secret, json_bytes)
    
    headers = {
        "Content-Type": "application/json",
        "X-Signature-SHA256": signature,
        "X-Event-Type": payload.event or "test.ping",
        "User-Agent": "LLM-Inference-Control-Plane/1.0"
    }

    start_time = time.time()
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.post(payload.target_url, content=json_bytes, headers=headers)
            duration_ms = (time.time() - start_time) * 1000.0
            return {
                "success": (200 <= resp.status_code < 300),
                "status_code": resp.status_code,
                "duration_ms": round(duration_ms, 2),
                "signature_sent": signature,
                "target_url": payload.target_url
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "duration_ms": round((time.time() - start_time) * 1000.0, 2),
                "signature_sent": signature,
                "target_url": payload.target_url
            }

@router.get("/logs")
def get_delivery_logs(api_key: str = Depends(verify_api_key)) -> Dict[str, Any]:
    """Retrieve audit delivery logs for dispatched webhooks."""
    return {
        "logs": webhook_dispatcher.list_logs()
    }
