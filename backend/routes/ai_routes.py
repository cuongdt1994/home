"""AI Analysis and blocking API routes."""

from fastapi import APIRouter, HTTPException, Query

from database import Alert, Analysis, BlockEvent, get_session
from services.deepseek_service import deepseek_service
from services.mikrotik_service import mikrotik_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/analyze/{alert_id}")
async def analyze_alert(alert_id: int):
    """Trigger AI analysis for a specific alert."""
    session = get_session()
    try:
        alert = session.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert_data = {
            "id": alert.id,
            "src_ip": alert.src_ip,
            "src_port": alert.src_port,
            "dest_ip": alert.dest_ip,
            "dest_port": alert.dest_port,
            "proto": alert.proto,
            "alert_signature": alert.alert_signature,
            "alert_category": alert.alert_category,
            "alert_severity": alert.alert_severity,
            "timestamp": alert.timestamp,
        }
    finally:
        session.close()

    try:
        result = await deepseek_service.analyze_and_store(alert_data, alert_id)
        return {"alert_id": alert_id, **result}
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/block/{alert_id}")
async def block_from_alert(alert_id: int):
    """Analyze alert with AI, and block if AI recommends it."""
    session = get_session()
    try:
        alert = session.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        alert_data = {
            "id": alert.id,
            "src_ip": alert.src_ip,
            "src_port": alert.src_port,
            "dest_ip": alert.dest_ip,
            "dest_port": alert.dest_port,
            "proto": alert.proto,
            "alert_signature": alert.alert_signature,
            "alert_category": alert.alert_category,
            "alert_severity": alert.alert_severity,
            "timestamp": alert.timestamp,
        }
    finally:
        session.close()

    try:
        result = await deepseek_service.analyze_and_store(alert_data, alert_id)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Execute block if AI recommends it
    if result.get("decision") == "block" and result.get("confidence", 0) >= 0.7:
        try:
            rule_id = await mikrotik_service.add_block_rule(
                src_ip=alert_data["src_ip"],
                comment=result.get("reasoning", "AI-recommended block"),
                timeout_hours=result.get("suggested_block_timeout_hours", 24),
            )

            # Log block event
            session = get_session()
            try:
                event = BlockEvent(
                    analysis_id=result.get("analysis_id"),
                    target_ip=alert_data["src_ip"],
                    action="block",
                    triggered_by="ai",
                    comment=result.get("reasoning", ""),
                )
                session.add(event)
                session.commit()
            except Exception as e:
                session.rollback()
            finally:
                session.close()

            return {
                "status": "blocked",
                "alert_id": alert_id,
                "rule_id": rule_id,
                "analysis": result,
            }
        except Exception as e:
            return {
                "status": "block_failed",
                "alert_id": alert_id,
                "error": str(e),
                "analysis": result,
            }

    return {
        "status": "not_blocked",
        "alert_id": alert_id,
        "decision": result.get("decision"),
        "confidence": result.get("confidence"),
        "analysis": result,
    }


@router.get("/history")
async def get_analysis_history(limit: int = Query(50, ge=1, le=200)):
    """Get AI analysis history."""
    return await deepseek_service.get_analysis_history(limit)


@router.get("/blocks")
async def get_block_history(limit: int = Query(50, ge=1, le=200)):
    """Get block event history."""
    session = get_session()
    try:
        events = session.query(BlockEvent).order_by(
            BlockEvent.created_at.desc()
        ).limit(limit).all()

        return [
            {
                "id": e.id,
                "analysis_id": e.analysis_id,
                "target_ip": e.target_ip,
                "action": e.action,
                "triggered_by": e.triggered_by,
                "comment": e.comment,
                "created_at": e.created_at,
            }
            for e in events
        ]
    finally:
        session.close()
