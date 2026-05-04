from app.setting.config import normalize_environment_key, parameters as param


def normalize(value):
    return str(value or "").strip().lower()


def get_environment_rules(feature_name):
    feature_rules = param.FEATURE_FLAGS.get(feature_name, {})
    current_environment = normalize_environment_key(param.ENVIRONMENTS)

    if not isinstance(feature_rules, dict):
        return None

    return feature_rules.get(current_environment)


def has_super_admin_permission(user):
    return bool(getattr(user, "is_super_admin", False))


def is_owner_user(user):
    return normalize(getattr(user, "role", "")) == "owner" and has_super_admin_permission(user)


def is_admin_user(user):
    role = normalize(getattr(user, "role", ""))
    return has_super_admin_permission(user) and role in {"owner", "admin"}


def is_feature_enabled(feature_name, user=None):
    if is_owner_user(user):
        return True

    environment_rules = get_environment_rules(feature_name)
    if not environment_rules:
        return False

    if not environment_rules.get("enabled", False):
        return False

    if user is None:
        return environment_rules.get("anonymous", False)

    if is_admin_user(user):
        return environment_rules.get("admin", False)

    if normalize(getattr(user, "role", "")) == "user":
        return environment_rules.get("user", False)

    return environment_rules.get("user", False)


def get_feature_flags(user=None):
    return {
        feature_name: is_feature_enabled(feature_name, user)
        for feature_name in sorted(param.FEATURE_FLAGS)
    }
