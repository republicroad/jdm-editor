import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/**
 * CodeMirror SKIN as an EditorView.theme() extension (roadmap P2 / Batch D).
 *
 * Everything here used to live as CSS in `tailwind.css` under `.grl-ce …`.
 * That lost the cascade war against CM's runtime-injected unlayered
 * baseTheme and needed !important band-aids (HK-03..07). Inside theme()
 * the declarations ride CodeMirror's own precedence — strictly above
 * baseTheme — so every !important drops away legitimately.
 *
 * Values deliberately reference the SAME custom properties the old CSS did
 * (--grl-* palette + --ce-* rhythm vars). Variable resolution happens at
 * computed-value time on each consumer node, independent of stylesheet
 * layering, which preserves:
 *   • data-mode flipping without re-registering anything,
 *   • per-instance overrides via [--ce-*] utilities on the host container.
 *
 * Component-owned layout classes (.max-rows/.full-height/.no-style/
 * .grl-ce-single) and the manual CodeHighlighter skeleton remain plain CSS
 * on purpose — see shadcn-theming-roadmap Appendix A, HK-03.
 *
 * Shared skin extension (module-level singleton).
 *
 * Safe to share across every EditorView in the process: the spec is immutable
 * and every value is a `var()` reference, so instances never diverge. Sharing
 * also removes per-instance object allocation for editors mounted en masse
 * (decision-table cells).
 */
export const ZEN_SKIN: Extension = EditorView.theme({
    // ── editor shell ────────────────────────────────────────────────────────
    '&': {
      background: 'var(--grl-color-bg-container)',
      width: '100%',
      maxWidth: '100%',
      border: '1px solid var(--grl-color-border)',
      borderRadius: '6px',
      transition: 'border-color, box-shadow 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)',
      lineHeight: 'var(--ce-lineHeight)',
    },
    '&.cm-focused': {
      outline: 'none',
      boxShadow: '0 0 0 2px var(--grl-control-outline)',
      borderColor: 'var(--grl-color-primary-hover)',
    },
    '&:hover': {
      borderColor: 'var(--grl-color-primary-hover)',
      borderInlineEndWidth: '1px',
    },

    '&[data-severity="error"]': {
      background: 'var(--grl-color-error-bg)',
      borderColor: 'var(--grl-color-error-border)',
    },
    '&[data-severity="warning"]': {
      background: 'var(--grl-color-warning-bg)',
      borderColor: 'var(--grl-color-warning-border)',
    },
    '&[data-severity="info"]': {
      background: 'var(--grl-color-info-bg)',
      borderColor: 'var(--grl-color-info-border)',
    },

    // lint underline strips (Images stay in CSS alongside highlighter variants)
    '& .cm-lintRange': {
      paddingBottom: '2.5px',
      backgroundPosition: 'left bottom',
      backgroundRepeat: 'repeat-x',
    },
    '& .cm-lintRange-warning': {
      backgroundImage:
        "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"6\" height=\"3\">%3Cpath%20d%3D%22m0%202.5%20l2%20-1.5%20l1%200%20l2%201.5%20l1%200%22%20stroke%3D%22%23FFA500%22%20fill%3D%22none%22%20stroke-width%3D%221.2%22%2F%3E</svg>')",
    },
    '& .cm-lintRange-error': {
      backgroundImage:
        "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"6\" height=\"3\">%3Cpath%20d%3D%22m0%202.5%20l2%20-1.5%20l1%200%20l2%201.5%20l1%200%22%20stroke%3D%22%23FF0000%22%20fill%3D%22none%22%20stroke-width%3D%221.2%22%2F%3E</svg>')",
    },
    '& .grl-ce-hover-tooltip': {
      fontFamily: 'var(--grl-font-family)',
      fontSize: '13px',
      background: 'var(--grl-color-bg-elevated)',
      border: 'none',
      borderRadius: '6px',
      color: 'var(--grl-color-text)',
      padding: '2px 8px',
    },
    '& .cm-lintPoint': {
      WebkitUserModify: 'read-write-plaintext-only',
    },
    '& .cm-diagnosticMessageToken': {
      padding: '2px 5px 3px',
      borderRadius: '5px',
      background: 'var(--diagnostic-chip-bg)',
    },
    '& .cm-hoverTooltipMessageToken': {
      filter: 'contrast(2) brightness(0.75)',
    },

    // ── scroll/content geometry ─────────────────────────────────────────────
    '& .cm-scroller': {
      fontFamily: 'monospace',
      lineHeight: 'inherit',
    },
    '& .cm-widgetBuffer': { display: 'none' },
    '& .cm-placeholder': { display: 'inline' },
    '& .cm-content': {
      padding: 'var(--ce-verticalPadding) var(--ce-horizontalPadding)',
    },
    '& .cm-line': {
      padding: '0',
      caretColor: 'var(--grl-color-text)',
    },
    '& .cm-line:focus-visible': { outline: 'none' },

    // ── tooltips / completion / lint popovers ───────────────────────────────
    '& .cm-tooltip': {
      fontFamily: 'var(--grl-font-family)',
      fontSize: '13px',
      background: 'var(--grl-color-bg-elevated)',
      border: 'none',
      borderRadius: '6px',
      color: 'var(--grl-color-text)',
    },
    '& .cm-tooltip.cm-tooltip-below': { marginTop: '8px' },
    '& .cm-tooltip > *': {
      border: '1px solid var(--grl-color-border)',
      borderRadius: '6px',
    },
    '& .cm-tooltip > ul li[aria-selected]': {
      background: 'var(--grl-color-primary-hover)',
      color: 'white',
    },
    '& .cm-tooltip > ul li[aria-selected] .cm-completionDetail': { color: 'white' },
    '& .cm-tooltip .cm-completionMatchedText': {
      textDecoration: 'none',
      color: 'var(--grl-color-primary-hover)',
    },
    '& .cm-tooltip .cm-completionDetail': {
      fontStyle: 'normal',
      color: 'var(--grl-color-text-secondary)',
    },
    '& .cm-tooltip .cm-tooltip-section:not(.cm-tooltip-lint)': {
      background: 'var(--tooltip-bg)',
      padding: '4px',
    },
    '& .cm-tooltip .cm-tooltip-lint': {
      background: 'var(--grl-color-bg-elevated)',
      border: '1px solid var(--grl-color-border)',
      padding: '4px',
      color: 'var(--grl-color-text)',
    },
    '& .cm-tooltip .cm-tooltip-lint .cm-diagnostic:not(:last-of-type)': { marginBottom: '4px' },
    '& .cm-tooltip .cm-tooltip-lint .cm-diagnostic-error': {
      borderLeftColor: 'var(--grl-color-error-border)',
    },
    '& .cm-tooltip .cm-tooltip-lint .cm-diagnostic-warning': {
      borderLeftColor: 'var(--grl-color-warning-border)',
    },
    '& .cm-tooltip .cm-diagnosticSource': { fontSize: '75%' },

    '& .cm-tooltip-autocomplete ul': { padding: '4px' },
    '& .cm-tooltip-autocomplete li': {
      padding: '4px 4px',
      display: 'flex',
      fontSize: '12px',
      color: 'var(--grl-color-text-base)',
      borderRadius: '4px',
    },
    '& .cm-tooltip-autocomplete li[aria-selected="true"]': {
      backgroundColor: 'var(--grl-color-border)',
    },
    '& .cm-completionIcon': { marginRight: '4px', opacity: '1' },
    '& .cm-completionIcon::after': {
      color: 'var(--icon-primary)',
      background: 'var(--icon-secondary)',
      borderRadius: '50%',
      border: '1px solid var(--icon-primary)',
      fontSize: '8px',
      width: '2.25ch',
      height: '2.25ch',
      display: 'inline-flex',
      justifyContent: 'center',
      alignItems: 'center',
      opacity: '1',
    },
    '& .cm-completionIcon-function::after': {
      content: "'f'",
      '--icon-primary': 'var(--grl-color-error)',
      '--icon-secondary': 'var(--grl-color-error-bg)',
    },
    '& .cm-completionIcon-method::after': {
      content: "'m'",
      '--icon-primary': 'var(--grl-color-error)',
      '--icon-secondary': 'var(--grl-color-error-bg)',
    },
    '& .cm-completionIcon-class::after': {
      content: "'C'",
      '--icon-primary': 'var(--grl-color-primary)',
      '--icon-secondary': 'var(--grl-color-primary-bg)',
    },
    '& .cm-completionIcon-interface::after': {
      content: "'I'",
      '--icon-primary': 'var(--grl-color-success)',
      '--icon-secondary': 'var(--grl-color-success-bg)',
    },
    '& .cm-completionIcon-type::after': {
      content: "'I'",
      '--icon-primary': 'var(--grl-color-success)',
      '--icon-secondary': 'var(--grl-color-success-bg)',
    },
    '& .cm-completionIcon-variable::after': {
      content: "'v'",
      '--icon-primary': 'var(--grl-color-warning)',
      '--icon-secondary': 'var(--grl-color-warning-bg)',
      filter: 'hue-rotate(-20deg)',
    },
    '& .cm-completionIcon-constant::after': {
      content: "'v'",
      '--icon-primary': 'var(--grl-color-warning)',
      '--icon-secondary': 'var(--grl-color-warning-bg)',
      filter: 'hue-rotate(-20deg)',
    },
    '& .cm-completionIcon-enum::after': {
      content: "'E'",
      '--icon-primary': 'var(--grl-color-primary)',
      '--icon-secondary': 'var(--grl-color-primary-bg)',
      filter: 'hue-rotate(35deg)',
    },
    '& .cm-completionIcon-property::after': {
      content: "'P'",
      '--icon-primary': 'var(--grl-color-primary)',
      '--icon-secondary': 'var(--grl-color-primary-bg)',
      filter: 'hue-rotate(40deg)',
    },
    '& .cm-completionIcon-keyword::after': {
      content: "'k'",
      '--icon-primary': 'var(--grl-color-warning)',
      '--icon-secondary': 'var(--grl-color-warning-bg)',
      filter: 'hue-rotate(-20deg)',
    },
    '& .cm-completionIcon-namespace::after': {
      content: "'n'",
      '--icon-primary': 'var(--grl-color-success)',
      '--icon-secondary': 'var(--grl-color-success-bg)',
    },
    '& .cm-completionIcon-text::after': {
      content: "'abc'",
      fontSize: '50%',
      verticalAlign: 'middle',
    },
  });
