# Theme Definition Template

When adding a new Theme, create `docs/specs/user-stories/<theme-name>.md` file:

```md
# THEME-XX: <Theme Name>

## Concept Definition

**Purpose**: User problem solved by this Theme

**State**:
- `<state_var>`: <type> — <description>

**Actions**:
- `action_name(params)`: <description>

**Operational Principle**:
> "When user performs [action1], [state change] occurs,
> and subsequently performing [action2] leads to [result]."

**Related Themes**: <Dependent or related Themes>

---

## Epics

### EPIC-XX: <Epic Title>
- Status: [Planned | In Progress | Done]

#### US-XXX: <Story Title>
**Operational Principle**: "<Operational principle of this Story>"

- [ ] AC-XXX-1: <criteria>
- [ ] AC-XXX-2: <criteria>

Related Transformations: T-XXXXXXXX-XXX
```
