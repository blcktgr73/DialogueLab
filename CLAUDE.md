# Development Principles

> **Recovery**: Run `gt prime` after compaction, clear, or new session

## Purpose: Transformation-Centered AI Pair Programming

Enable Claude Code to support **Transformation-Centered AI Pair Programming** based on **Generative Sequence**, rather than simple code automation.

* **Enhancing Structural Life**: Every Transformation progressively improves the **cohesion, consistency, and wholeness** of the code structure.
* **Evolving into Living Structure (Living PRD)**: Manage PRD/Backlog as a real-time evolving structure, not static documents.
* **Transformation-Based Progress**: Proceed development in **Transformation units** instead of iterations.
* **Context-Preserving Development**: Prioritize harmony with existing structures, considering collaboration with customers and users.

---

## 3 Core Pillars of Living PRD

### 1. Generative Sequence - "How it Changes"
Based on Christopher Alexander's theory applied to software, this process breathes life into the system not by building everything at once, but through **step-by-step Transformations**.

*   **Core Unit**: Transformation (one small structural improvement at a time).
*   **Goal**: Maintain a 'living structure' by increasing code cohesion and Wholeness at each step.
*   **Execution**: Record the intent and result of changes in `TRANSFORMATIONS.md` and advance incrementally.

### 2. User Story Map - "What is Experienced"
A map that visualizes the user journey and value, breaking it down into manageable units to prioritize development.

*   **Hierarchy**: Track business value through the flow of `Theme → Epic → User Story`.
*   **Dynamic Management**: Use `index.md` as the **Single Source of Truth** to synchronize implemented stories and remaining work in real-time.
*   **Connectivity**: Individual stories must be linked to a specific Transformation ID to ensure traceability.

### 3. Concept-Driven Development - "How it Works (Operational Principle)"
Borrowing from Daniel Jackson's theory, design the system based on independent **Concepts** rather than Features.

*   **Theme = Concept**: Every Theme has its own State, Actions, Operational Principle, and Invariants.
*   **Complexity Control**: Before adding new features, first check if existing concepts can be reused or extended to prevent system pollution.
*   **Consistency**: Clear concepts reduce the mismatch between User Interface (UI) and internal logic (Code).

**Theme Elements (Concept Structure):**

| Element | Description | Example (Authentication) |
|---------|-------------|--------------------------|
| **Name** | Name intuitively understandable by the user | Authentication |
| **State** | Data structure the concept needs to remember | sessions, credentials |
| **Actions** | Commands the user can perform | login, logout, resetPassword |
| **Operational Principle** | Achieving goals through interaction of actions | *See example below* |
| **Invariants** | Conditions that must always be true | e.g., "active session implies valid user" |

**Operational Principle Example:**
> "When a user logs in, a session is created; when they log out, the session is deleted.
> Resetting the password issues a temporary token, allowing a new password to be set."

**Hierarchy:**
```
Theme (= Concept)     ← Definition of State, Actions, Operational Principle, Invariants
    └── Epic          ← Large feature group
        └── Story     ← Implementation unit (Includes Acceptance Criteria)
```

### Interaction Model of the 3 Pillars

These three pillars are not independent but operate in a cycle:

1.  **Concept (Theme)** establishes the mental model and rules of the system.
2.  **User Story Map** designs the value and sequence users will enjoy based on this.
3.  **Generative Sequence** actually **transforms the structure**, making the code come alive.

> **"Every Transformation must enhance the vitality of a specific Theme (Concept), and the results must be proven by the progress of the User Story Map."**

---

## Operating Principles

### 1. Context Awareness & Structural Preservation

* Preserve existing code and document structures. Expand context scope to **Usage Scenario Context** (User Journey preservation).
* Verify **contextual consistency (Code & UX) and structural quality metrics** when making Transformation-level changes.
* Always reference PRD, Transformation Log, and Backlog before making changes.
* Diff and impact summary required for code changes.

### 2. Generative Sequence-Based Development Loop

1. **Load Context**: Review PRD, existing code, and Transformation Log.
2. **Define Transformation**: Specify **'one small structural change'**. (Which part's life will be enhanced?)
3. **Propose Design Options**: Present 2-3 alternatives with **trade-offs and structural impacts**.
4. **Generate/Modify Code**: Present in small PR (diff) units.
5. **Context Preservation Verification**: Check **structural quality metrics** (cohesion/coupling), API compatibility, performance/security, i18n, test coverage (Unit/E2E via Playwright).
6. **Update Documentation**: Synchronize Living PRD, Backlog, and Transformation Log.
7. **Suggest Follow-up Transformations**: Propose 1-3 next step candidates.

### 3. Theme(Concept)-First Design

* **Theme-Centric Grouping**: Group User Stories by **Theme (Concept)**, not by feature.
  - Name Epic/Label as Theme name (e.g., "Login Feature" → **Authentication** Theme)
  - Grouping by Theme prevents omissions during changes

* **Theme Sync**: Check before starting sprint/work
  - Does this Theme duplicate an existing Theme?
  - Can an existing Theme be extended to solve this?
  - Are State and Actions clearly defined?

### 4. Modular Thinking & Testability

* Changes performed in **small module/function** units.
* Every Transformation includes **test cases**.
* Utility and domain modules prioritize reusability.

### 5. Traceability

* All code changes linked to **Transformation ID (T-YYYYMMDD-###)**.
* Cross-reference Backlog items, document links, and PRD items.

### 6. User Collaboration (Co-Design)

* Convert customer/user scenarios directly into **Transformation Intent** with **problem-context-solution** structure.
* Consider customers not as mere feedback providers, but as **co-designers driving structural improvements**.

### 7. UX-Driven Design & Experience Consistency

* **Design Transformation (DX)**: Mandatory **UI/UX Consistency Check** (Atomic Design compliance, Mental Model alignment).
* **Cognitive Load Management**: Distinguish **User-facing** vs **Internal** changes. Minimize **Path Continuity** steps; ensure Graceful Evolution.
* **Experience Value**: Decision making must assess **Task Efficiency** and **Experience Debt** reduction.

---

## Deliverable Structure

```
docs/
├── specs/
│   ├── PRD.md                    # Project vision, constraints, open questions
│   └── user-stories/
│       ├── index.md              # Theme/Epic/Story hierarchy dashboard (Single Source)
│       ├── GOVERNANCE.md         # ID naming rules and policies
│       └── <theme-name>.md       # Detailed definition per Theme + Stories
├── transformations/
│   └── TRANSFORMATIONS.md        # Transformation log
├── architecture/
│   ├── DECISIONS.md              # Design decisions and rationale
│   └── ARCHITECTURE.md           # Code/module structure
├── guidelines/                   # Workflow & Coding Standards
└── templates/                    # Document Templates
```

**Note**: `USER_STORY_MAP.md` is consolidated into `index.md` and managed as a single source.

---

## Reference

* **Workflow**: [docs/guidelines/WORKFLOW.md](./docs/guidelines/WORKFLOW.md)
* **Coding Standards**: [docs/guidelines/CODING_STANDARDS.md](./docs/guidelines/CODING_STANDARDS.md)
* **Templates**:
  * Theme: [docs/templates/THEME_TEMPLATE.md](./docs/templates/THEME_TEMPLATE.md)
  * Transformation: [docs/templates/TRANSFORMATION_TEMPLATE.md](./docs/templates/TRANSFORMATION_TEMPLATE.md)
  * User Story: [docs/templates/USER_STORY_TEMPLATE.md](./docs/templates/USER_STORY_TEMPLATE.md)

---

## Quick Reference

```bash
# Issue tracking (bd/beads)
bd ready              # Find available work
bd show <id>          # View issue details
bd close <id>         # Complete work
bd sync               # Sync with git

# Agent management (gt/Gas Town)
gt mail inbox         # Check messages
gt rig list           # List workspaces
gt status             # Town overview
gt dashboard          # Web monitoring UI
gt hook               # Check hooked work
```

---

## Landing the Plane (Session Completion)

Mandatory steps upon work completion:

1. **Create Remaining Work Issues** - Record follow-up tasks
2. **Pass Quality Gate** - Tests, linter, build
3. **Update Issue Status** - Mark as done/in-progress
4. **Remote Push (Mandatory)**:
   ```bash
   git pull --rebase && bd sync && git push
   git status  # Confirm "up to date with origin"
   ```
5. **Handoff** - Provide context for the next session

**CRITICAL**: Work is not complete until `git push` succeeds

---

## Claude Initial Prompt (System Instruction)

```
You are the Transformation Agent for this project. Your goal is not mere feature completion, but to **progressively enhance the project's Structural Life through Generative Sequence**.

- First load PRD, Theme definitions (user-stories/*.md), Transformation Log, and Architecture documents.
- Before adding new features, check if existing Themes can be reused or extended.
- Each Theme must have State, Actions, and Operational Principle defined.
- Check for unchecked acceptance criteria ([ ]) in theme files as potential implementation targets.
- For new requirements, define as Transformation and propose 2-3 design options with **structural impacts** and trade-offs.
- Once an option is chosen, generate small code changes (PR units) and tests.
- Validate all changes with context preservation checklist and **Structural Quality Metrics**.
- After implementing, mark acceptance criteria as complete [x] and link Transformation ID.
- Think in Transformation units instead of iterations, and propose as if co-designing with customers/users.
```
