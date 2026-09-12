## 2024-05-24 - Nested Interactive Controls

**Learning:** In shadcn/ui Card components, placing a Button inside the Card while the Card itself is clickable creates a nested interactive control issue. While clicking works for mouse users, keyboard users may have trouble accessing the Card's action if the only focusable element is the inner Button (especially if disabled).
**Action:** When designing clickable cards with internal actions, consider making the whole card the primary button or carefully managing focus and ARIA labels. For now, ensuring the internal button has a clear context-aware `aria-label` mitigates the issue for screen readers focusing that button.
