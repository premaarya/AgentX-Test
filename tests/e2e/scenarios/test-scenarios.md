# E2E Test Scenarios

## Scenario 1: Happy Path - Full Orchestration

### Flow
```
Epic Issue Created
    ↓
Product Manager Triggered
    ↓
Features & Stories Created
    ↓
Feature → Architect → ADR + Spec
    ↓
Story → Engineer → Code + Tests + PR
    ↓
PR → Reviewer → Review Complete
```

### Expected Outcomes
1. PRD created at `docs/prd/PRD-{issue}.md`
2. Feature issues created with `type:feature` label
3. Story issues created with `type:story` label
4. ADR created at `docs/adr/ADR-{issue}.md`
5. Tech Spec created at `docs/specs/SPEC-{issue}.md`
6. Code changes committed
7. Tests written and passing
8. PR created and labeled `needs-review`
9. Review document created at `docs/reviews/REVIEW-{issue}.md`

### Validation Points
- [ ] All artifacts created in correct locations
- [ ] Issue labels transition correctly
- [ ] Event-driven triggers fire immediately
- [ ] Metrics recorded for each workflow
- [ ] No errors in workflow logs

---

## Scenario 2: Feature-Only Flow

### Flow
```
Feature Issue Created
    ↓
Architect Triggered
    ↓
ADR + Spec Created
    ↓
Engineer Triggered (event-driven)
    ↓
Code + Tests + PR
```

### Expected Outcomes
1. ADR created
2. Tech Spec created
3. Engineer triggered within 30 seconds
4. Code implemented
5. PR created

### Validation Points
- [ ] Architect completes successfully
- [ ] Engineer triggered immediately (not after 5 min)
- [ ] Timing metrics show <30 sec handoff

---

## Scenario 3: Story with UX Requirement

### Flow
```
Story Issue with needs:ux
    ↓
UX Designer Triggered
    ↓
Wireframes Created
    ↓
Engineer Triggered
    ↓
Code + Tests + PR
```

### Expected Outcomes
1. UX document created at `docs/ux/UX-{issue}.md`
2. Wireframes included
3. Engineer triggered after UX complete
4. Implementation follows UX design

### Validation Points
- [ ] UX Designer triggered first (before Engineer)
- [ ] UX artifacts created
- [ ] Engineer references UX document

---

## Scenario 4: Bug Fix Flow

### Flow
```
Bug Issue Created
    ↓
Engineer Triggered
    ↓
Fix + Tests + PR
    ↓
Reviewer
```

### Expected Outcomes
1. Bug fix committed
2. Regression test added
3. PR created quickly
4. Review completed

### Validation Points
- [ ] No Architect stage (bugs skip design)
- [ ] Fast turnaround time
- [ ] Tests verify fix

---

## Scenario 5: Error Handling

### Test Cases

#### 5.1 Invalid Issue State
- Create issue without required labels
- Expected: Orchestrator skips or handles gracefully

#### 5.2 Workflow Trigger Failure
- Simulate network error during trigger
- Expected: Fallback to polling orchestrator

#### 5.3 Missing Inputs
- Trigger workflow without required issue_number
- Expected: Workflow fails with clear error message

#### 5.4 Concurrent Modifications
- Two agents work on same issue
- Expected: Concurrency control prevents conflicts

### Validation Points
- [ ] Errors logged clearly
- [ ] Fallback mechanisms work
- [ ] No data corruption
- [ ] Issues marked with error labels
