# React Native Responsive Design Rules

## Core Principles
- **NEVER use fixed pixel values** for layout, spacing, or sizing
- **ALWAYS use useWindowDimensions** for responsive calculations
- **ALWAYS use SafeAreaView and useSafeAreaInsets** for device boundaries
- **ALWAYS use percentages and ratios** for all dimensions

## Required Imports
```tsx
import { useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
```

## Layout Structure Rules
1. **Every page must start with SafeAreaView**
2. **Use useWindowDimensions() hook at the top of every component**
3. **Use useSafeAreaInsets() hook for safe area handling**
4. **Wrap main content in a container View with responsive padding**

## SafeAreaView Rules
```tsx
const { width, height } = useWindowDimensions();
const insets = useSafeAreaInsets();

return (
  <SafeAreaView style={[styles.container, {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    backgroundColor: '#your-color'
  }]}>
    <View style={styles.container}>
      {/* Your content */}
    </View>
  </SafeAreaView>
);
```

## Dimension Conversion Rules
- **Width**: `width * 0.XX` (e.g., `width * 0.9` for 90%)
- **Height**: `height * 0.XX` (e.g., `height * 0.1` for 10%)
- **Font Sizes**: `width * 0.XX` (e.g., `width * 0.04` for 4%)
- **Border Radius**: `width * 0.XX` (e.g., `width * 0.05` for 5%)
- **Margins/Padding**: `width * 0.XX` or `height * 0.XX`
- **Icon Sizes**: `width * 0.XX` (e.g., `width * 0.06` for 6%)

## Common Responsive Values
- **Small spacing**: `width * 0.01` to `width * 0.02`
- **Medium spacing**: `width * 0.03` to `width * 0.05`
- **Large spacing**: `width * 0.06` to `width * 0.1`
- **Card padding**: `width * 0.04`
- **Button height**: `height * 0.06`
- **Header height**: `height * 0.08 + insets.top`
- **Input height**: `height * 0.05`

## Platform-Specific Rules
```tsx
// Use Platform.OS for device-specific styling
paddingTop: Platform.OS === 'ios' ? insets.top * 0.3 : insets.top,
height: Platform.OS === 'ios' ? height * 0.06 : height * 0.08,
```

## Form and Input Rules
- **Input containers**: Use `width * 0.9` for full width
- **Input heights**: Use `height * 0.05` to `height * 0.06`
- **Input padding**: Use `width * 0.03` to `width * 0.04`
- **Label margins**: Use `height * 0.01` to `height * 0.02`

## Button Rules
- **Button heights**: Use `height * 0.06` to `height * 0.08`
- **Button widths**: Use `width * 0.8` to `width * 0.9`
- **Button padding**: Use `width * 0.04`
- **Button margins**: Use `height * 0.02` to `height * 0.04`

## Card and Container Rules
- **Card margins**: Use `width * 0.04`
- **Card padding**: Use `width * 0.04`
- **Card border radius**: Use `width * 0.05`
- **Section margins**: Use `height * 0.02` to `height * 0.03`

## Text and Typography Rules
- **Large headings**: `width * 0.06` to `width * 0.08`
- **Medium headings**: `width * 0.04` to `width * 0.06`
- **Body text**: `width * 0.035` to `width * 0.045`
- **Small text**: `width * 0.03` to `width * 0.035`
- **Line heights**: Use `height * 0.XX` for responsive line spacing

## Icon and Image Rules
- **Large icons**: `width * 0.08` to `width * 0.1`
- **Medium icons**: `width * 0.05` to `width * 0.07`
- **Small icons**: `width * 0.03` to `width * 0.05`
- **Avatar sizes**: `width * 0.15` to `width * 0.2`

## Spacing and Layout Rules
- **Container padding**: `width * 0.04`
- **Section spacing**: `height * 0.02` to `height * 0.04`
- **Element margins**: `height * 0.01` to `height * 0.03`
- **Form spacing**: `height * 0.015` to `height * 0.025`

## ScrollView Rules
- **Content padding**: `height * 0.02` to `height * 0.05`
- **Bottom padding**: `height * 0.1 + insets.bottom` for tab bar clearance

## Tab Bar Rules
- **Tab bar height**: `height * 0.09`
- **Tab bar padding**: `height * 0.015`
- **Bottom positioning**: `bottom: insets.bottom`

## Keyboard Handling Rules
- **Keyboard avoiding**: Use KeyboardAvoidingView for forms
- **Scroll padding**: Ensure content doesn't get hidden behind keyboard
- **Bottom content**: Position critical elements above keyboard area

## Testing Rules
- **Test on multiple devices**: iPhone, Android, different screen sizes
- **Verify safe areas**: Ensure content respects notches and status bars
- **Check scrolling**: Ensure all content is accessible via scroll
- **Validate touch targets**: Ensure buttons are properly sized for touch

## Code Quality Rules
- **No hardcoded pixels**: Search for and replace any remaining pixel values
- **Consistent naming**: Use descriptive names for responsive values
- **Comment complex calculations**: Explain non-obvious responsive logic
- **Group related styles**: Keep responsive styles organized and readable

## Error Prevention Rules
- **Always destructure**: `const { width, height } = useWindowDimensions()`
- **Check imports**: Ensure SafeAreaView and useSafeAreaInsets are imported
- **Validate calculations**: Test edge cases (very small/large screens)
- **Fallback values**: Provide reasonable defaults for extreme screen sizes

## Performance Rules
- **Memoize calculations**: Use useMemo for complex responsive calculations
- **Avoid inline styles**: Move complex responsive styles to StyleSheet when possible
- **Optimize re-renders**: Only recalculate dimensions when necessary

## Accessibility Rules
- **Touch target size**: Minimum `height * 0.06` for interactive elements
- **Text contrast**: Ensure readable text sizes on all screen sizes
- **Spacing consistency**: Maintain consistent spacing patterns across the app
