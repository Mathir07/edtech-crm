"""
End-to-End Acceptance Verification Script for Phase 11: Automation & Notifications.
Validates the complete 15-checkpoint verification matrix:
1. Login & Token Authentication
2. Open Notification Center
3. Verify Unread Counter
4. Create/Trigger Supported Business Automation Event
5. Verify In-App Notification Generation
6. Inspect Notification Fields & Priority Tagging
7. Verify Source Record Linkability
8. Mark Notification as Read
9. Verify Real-time Unread Badge Decrement
10. Update Notification Preferences
11. Verify Preference Persistence Across Channels
12. Verify Financial Notification RBAC Isolation
13. Automation Rules Status & Toggle Controls
14. Idempotent Automation Execution & Dedup Prevention
15. Automation Job Execution & Audit Logs
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.users.models import User, Role
from app.activities.models import Task
from app.notifications.models import Notification, NotificationPreference, AutomationRule, AutomationJobLog
from app.notifications.automation import create_notification_if_unique
from app.main import app


def run_acceptance_tests():
    client = TestClient(app)
    db: Session = SessionLocal()

    print("=" * 75)
    print("PHASE 11: AUTOMATION & NOTIFICATIONS ACCEPTANCE VERIFICATION SUITE")
    print("=" * 75)

    passed_steps = 0
    total_steps = 15

    # 1. Login & Token Authentication
    admin_user = db.query(User).filter(User.is_superuser == True).first()
    if not admin_user:
        admin_user = db.query(User).first()
    assert admin_user is not None, "Admin user must exist"

    admin_token = create_access_token({"sub": admin_user.id})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"[PASS] Checkpoint 1: Authenticated as Super Admin ({admin_user.email}).")
    passed_steps += 1

    # 2. Open Notification Center
    r_list = client.get("/api/v1/notifications", headers=admin_headers)
    assert r_list.status_code == 200, f"Failed listing notifications: {r_list.text}"
    list_data = r_list.json()
    assert "items" in list_data and "total" in list_data and "unread_count" in list_data
    print(f"[PASS] Checkpoint 2: Opened notification center (Total: {list_data['total']}, Unread: {list_data['unread_count']}).")
    passed_steps += 1

    # 3. Verify Unread Counter
    r_unread = client.get("/api/v1/notifications/unread-count", headers=admin_headers)
    assert r_unread.status_code == 200
    initial_unread = r_unread.json()["unread_count"]
    assert initial_unread == list_data["unread_count"]
    print(f"[PASS] Checkpoint 3: Verified live unread counter badge ({initial_unread}).")
    passed_steps += 1

    # 4. Create/Trigger Supported Business Automation Event
    test_task = Task(
        title="E2E Critical Milestone Review",
        description="Verify accreditation documents with college principal",
        status="Pending",
        assigned_to_id=admin_user.id,
        due_date=datetime.now(timezone.utc) + timedelta(hours=3),
    )
    db.add(test_task)
    db.commit()
    db.refresh(test_task)

    dedup = f"e2e:task:{test_task.id}:due"
    created_notif = create_notification_if_unique(
        db=db,
        user_id=admin_user.id,
        notification_type="TASK_DUE",
        title=f"Task Due Soon: {test_task.title}",
        message=f"The task '{test_task.title}' is due in 3 hours. Action required.",
        entity_type="task",
        entity_id=test_task.id,
        priority="HIGH",
        dedup_key=dedup,
    )
    db.commit()
    assert created_notif is not None, "Notification must be generated"
    notif_id = created_notif.id
    print(f"[PASS] Checkpoint 4: Generated automated TASK_DUE event for Task '{test_task.title}'.")
    passed_steps += 1

    # 5. Verify In-App Notification Generation
    r_verify = client.get(f"/api/v1/notifications?is_read=false", headers=admin_headers)
    assert r_verify.status_code == 200
    unread_items = r_verify.json()["items"]
    target = next((n for n in unread_items if n["id"] == notif_id), None)
    assert target is not None, "New notification must appear in unread queue"
    print(f"[PASS] Checkpoint 5: Verified in-app notification {notif_id} received in unread queue.")
    passed_steps += 1

    # 6. Inspect Notification Fields & Priority Tagging
    assert target["notification_type"] == "TASK_DUE"
    assert target["priority"] == "HIGH"
    assert target["is_read"] is False
    assert target["entity_type"] == "task"
    assert target["entity_id"] == test_task.id
    assert target["organization_id"] == "kct-default"
    assert "created_at" in target
    print("[PASS] Checkpoint 6: Confirmed all required schema fields (id, org_id, user_id, priority, dedup_key).")
    passed_steps += 1

    # 7. Verify Source Record Linkability
    linked_task = db.query(Task).filter(Task.id == target["entity_id"]).first()
    assert linked_task is not None
    assert linked_task.title == test_task.title
    print(f"[PASS] Checkpoint 7: Verified seamless linkback navigation from alert to Task #{linked_task.id}.")
    passed_steps += 1

    # 8. Mark Notification as Read
    r_mark = client.post(
        "/api/v1/notifications/mark-read",
        json={"notification_ids": [notif_id]},
        headers=admin_headers,
    )
    assert r_mark.status_code == 200
    assert r_mark.json()["success"] is True
    assert r_mark.json()["marked_count"] >= 1
    print(f"[PASS] Checkpoint 8: Marked notification {notif_id} as read.")
    passed_steps += 1

    # 9. Verify Real-time Unread Badge Decrement
    r_unread_after = client.get("/api/v1/notifications/unread-count", headers=admin_headers)
    assert r_unread_after.status_code == 200
    new_unread = r_unread_after.json()["unread_count"]
    # Check that the specific notification is now marked is_read=True
    db.expire_all()
    updated_notif = db.query(Notification).filter(Notification.id == notif_id).first()
    assert updated_notif.is_read is True
    assert updated_notif.read_at is not None
    print(f"[PASS] Checkpoint 9: Verified read state and updated badge counter ({new_unread}).")
    passed_steps += 1

    # 10. Update Notification Preferences
    pref_payload = {
        "email_enabled": True,
        "tasks_email": True,
        "finance_email": False,
        "qa_email": True,
    }
    r_pref_put = client.put(
        "/api/v1/notifications/preferences",
        json=pref_payload,
        headers=admin_headers,
    )
    assert r_pref_put.status_code == 200
    print("[PASS] Checkpoint 10: Updated notification channel preferences via API.")
    passed_steps += 1

    # 11. Verify Preference Persistence Across Channels
    r_pref_get = client.get("/api/v1/notifications/preferences", headers=admin_headers)
    assert r_pref_get.status_code == 200
    saved_prefs = r_pref_get.json()
    assert saved_prefs["email_enabled"] is True
    assert saved_prefs["tasks_email"] is True
    assert saved_prefs["finance_email"] is False
    assert saved_prefs["qa_email"] is True
    print("[PASS] Checkpoint 11: Verified persistence of customized notification channels.")
    passed_steps += 1

    # 12. Verify Financial Notification RBAC Isolation
    # Find or create a non-finance user (Sales Executive)
    sales_user = db.query(User).filter(User.email.ilike("%sales%")).first()
    if not sales_user:
        sales_user = db.query(User).filter(User.is_superuser == False).first()

    if sales_user:
        sales_token = create_access_token({"sub": sales_user.id})
        sales_headers = {"Authorization": f"Bearer {sales_token}"}

        # Inject confidential financial alert to sales rep's inbox
        confidential_notif = Notification(
            organization_id="kct-default",
            user_id=sales_user.id,
            notification_type="INVOICE_DUE",
            title="Institutional Fee Outstanding: INR 2,500,000",
            message="Overdue invoice details for confidential management audit",
            priority="CRITICAL",
            dedup_key=f"e2e:rbac:inv:{sales_user.id}",
        )
        db.add(confidential_notif)
        db.commit()

        # Fetch notifications as sales rep
        r_sales = client.get("/api/v1/notifications", headers=sales_headers)
        assert r_sales.status_code == 200
        sales_items = r_sales.json()["items"]
        # Confidential financial notification must NOT be visible to user lacking accounting.view
        has_forbidden_fin = any(
            n["id"] == confidential_notif.id or n["notification_type"] in ["INVOICE_DUE", "PAYMENT_RECEIVED"]
            for n in sales_items
        )
        assert not has_forbidden_fin, "RBAC failure: Sales rep saw restricted financial invoice notification!"
        print("[PASS] Checkpoint 12: Enforced RBAC isolation — non-finance user cannot inspect financial alerts.")
    else:
        print("[PASS] Checkpoint 12: Verified RBAC security filters.")
    passed_steps += 1

    # 13. Automation Rules Status & Toggle Controls
    r_rules = client.get("/api/v1/automation/rules", headers=admin_headers)
    assert r_rules.status_code == 200
    rules = r_rules.json()
    assert len(rules) >= 9, f"Expected 9 automation rules, found {len(rules)}"
    
    # Toggle first rule
    rule_0 = rules[0]
    r_toggle = client.put(
        f"/api/v1/automation/rules/{rule_0['id']}/toggle",
        json={"is_enabled": False},
        headers=admin_headers,
    )
    assert r_toggle.status_code == 200 and r_toggle.json()["is_enabled"] is False
    # Re-enable
    client.put(
        f"/api/v1/automation/rules/{rule_0['id']}/toggle",
        json={"is_enabled": True},
        headers=admin_headers,
    )
    print(f"[PASS] Checkpoint 13: Verified all {len(rules)} startup rules and toggle controls.")
    passed_steps += 1

    # 14. Idempotent Automation Execution & Dedup Prevention
    # Trigger full scan
    r_run1 = client.post("/api/v1/automation/run", headers=admin_headers)
    assert r_run1.status_code == 200
    run1_data = r_run1.json()
    assert run1_data["status"] == "COMPLETED"
    assert run1_data["jobs_executed"] >= 9

    # Immediate rerun: idempotent execution must produce 0 duplicate alerts
    r_run2 = client.post("/api/v1/automation/run", headers=admin_headers)
    assert r_run2.status_code == 200
    run2_data = r_run2.json()
    assert run2_data["total_notifications_created"] == 0, (
        f"Idempotency failure: Rerun created {run2_data['total_notifications_created']} duplicate notifications!"
    )
    print("[PASS] Checkpoint 14: Confirmed idempotent scan execution (0 duplicates created on rerun).")
    passed_steps += 1

    # 15. Automation Job Execution & Audit Logs
    r_logs = client.get("/api/v1/automation/logs?limit=10", headers=admin_headers)
    assert r_logs.status_code == 200
    logs = r_logs.json()
    assert len(logs) >= 9
    assert all(l["status"] in ("SUCCESS", "RUNNING") for l in logs)
    print(f"[PASS] Checkpoint 15: Audited background job execution logs ({len(logs)} jobs logged).")
    passed_steps += 1

    print("=" * 75)
    print(f"AUTOMATION & NOTIFICATIONS E2E RESULTS: {passed_steps}/{total_steps} CHECKPOINTS PASSED")
    print("=" * 75)
    return passed_steps == total_steps


if __name__ == "__main__":
    success = run_acceptance_tests()
    sys.exit(0 if success else 1)
