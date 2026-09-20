from typing import Dict, List, Any


def build_user_context(
    user_id: str,
    current_session: Dict[str, Any],
    all_sessions: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Build user behavioural context using only selections that happened
    before the current recommendation session was created.

    A previous session is counted only when:
        previous.selection.selectedAt < current.createdAt

    This prevents future selections from leaking into training history.
    """

    current_created_at = current_session.get("createdAt")

    # Without the current session creation time, we cannot safely
    # determine which selections were already known at that point.
    if current_created_at is None:
        return {
            "userPreviousSessions": 0,
        }

    previous_user_sessions = []

    for session in all_sessions:

        # Only sessions belonging to the same user.
        if str(session.get("userId")) != str(user_id):
            continue

        # Do not count the current session.
        if str(session.get("_id")) == str(current_session.get("_id")):
            continue

        selection = session.get("selection") or {}

        # Only completed recommendation sessions are useful.
        if selection.get("stationId") is None:
            continue

        selected_at = selection.get("selectedAt")

        # If we do not know when the selection happened, it cannot
        # safely be treated as previous history.
        if selected_at is None:
            continue

        # The selection must have happened before the current
        # recommendation session was created.
        if selected_at >= current_created_at:
            continue

        previous_user_sessions.append(session)

    return {
        "userPreviousSessions": len(previous_user_sessions),
    }