from app.setting.config import (
    is_dev_environment_name,
    is_production_environment,
    parameters as param,
)


def normalize(value):
    return str(value or "").strip().lower()


def environments_match(rule_environment, current_environment):
    rule = normalize(rule_environment)
    current = normalize(current_environment)

    if rule in {"", "*", "all"}:
        return True
    if rule == current:
        return True
    if is_dev_environment_name(rule) and is_dev_environment_name(current):
        return True
    if is_production_environment(rule) and is_production_environment(current):
        return True

    return False


def get_environment_audience_groups(feature_name):
    environment_rules = param.FEATURE_FLAGS.get(feature_name, {})
    current_environment = param.ENVIRONMENTS

    for environment_name, audience_groups in environment_rules.items():
        if normalize(environment_name) == normalize(current_environment):
            return audience_groups

    for environment_name, audience_groups in environment_rules.items():
        if environments_match(environment_name, current_environment):
            return audience_groups

    return None


def has_super_admin_permission(user):
    return bool(getattr(user, "is_super_admin", False))


def audience_requirement_allowed(requirement, user):
    requirement = normalize(requirement)

    if requirement in {"all", "everyone", "on", "public"}:
        return True
    if requirement in {"authenticated", "auth", "users"}:
        return user is not None
    if user is None:
        return False
    if requirement in {"super_admin", "super_admins"}:
        return has_super_admin_permission(user)
    if requirement in {"owner", "owners"}:
        return normalize(getattr(user, "role", "")) == "owner"
    if requirement in {"admin", "admins"}:
        return (
            normalize(getattr(user, "role", "")) == "owner"
            and has_super_admin_permission(user)
        )

    role = normalize(getattr(user, "role", ""))
    return role == requirement


def audience_group_allowed(group, user):
    return all(audience_requirement_allowed(requirement, user) for requirement in group)


def is_feature_enabled(feature_name, user=None):
    audience_groups = get_environment_audience_groups(feature_name)
    if audience_groups is None:
        return False

    return any(audience_group_allowed(group, user) for group in audience_groups)


def get_feature_flags(user=None):
    return {
        feature_name: is_feature_enabled(feature_name, user)
        for feature_name in sorted(param.FEATURE_FLAGS)
    }
