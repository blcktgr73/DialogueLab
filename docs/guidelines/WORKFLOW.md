# User Story-Based Development Workflow

## Core Documents
- **user-stories/index.md**: Theme/Epic/Story hierarchy dashboard (Single Source of Truth)
- **user-stories/<theme>.md**: Detailed definition per Theme (State, Actions, OP, Invariants) + Epic/Story list

## Development Process

1. **Identify Work**: Check unchecked acceptance criteria `[ ]` in theme files
2. **Discuss if Needed**: Complex requirements → clarify via conversation
3. **Implement**: Create code changes as Transformation
4. **Record**: Link Transformation to User Story ID (e.g., "Related: US-010")
5. **Mark Complete**: Check acceptance criteria `[x]` and update story status
6. **Update Index**: Reflect status changes in index.md

## Adding New Themes
Review first when adding a new Theme:
- Does it duplicate an existing Theme?
- Can it be solved by extending an existing Theme?

## Adding New User Stories
- **ID**: Use sequence THEME-XX, EPIC-XX, US-XXX
- **Theme**: Must specify the Theme to which the story belongs
- **Location**: Define first in `index.md`, then add details in `<theme>.md`
- **Governance**: Follow `GOVERNANCE.md` rules
- **Status**: Initial status is Planned
