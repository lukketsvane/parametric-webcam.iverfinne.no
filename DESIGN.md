# Parametric Studio UI port

Source: https://github.com/lukketsvane/parametric.iverfinne.no, inspected 20 October 2026.

The webcam UI uses the existing studio's actual component layout and interaction model: full model stage, small top-right site link, 448 px maximum-width bottom dock with 24 px corners, 40 px circular action buttons, 32 px native picker, 11 px tracked labels, thin parameter sliders, and an expandable body limited to 56 viewport-height units. The component layout is ported to browser-native HTML/CSS without the unrelated sculpture engines.

Pure white/black colors follow the system. Safe-area padding follows the original dock. Expanded controls take space in the page layout, leaving the model visible. Export is a direct action in the dock and an inline format row. Touch gestures are ported from the original GestureParams component.
