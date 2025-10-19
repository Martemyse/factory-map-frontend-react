# Debugging Guide for React Frontend

## Quick Setup

### 1. Start Your Development Server
```bash
cd apps/frontend
npm run dev
```

### 2. Open Debug Panel in Cursor
- Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac)
- Or click the "Run and Debug" icon in the sidebar

### 3. Select Debug Configuration
- Choose "Debug React App" from the dropdown
- Click the green play button or press `F5`

## Setting Breakpoints

### Method 1: Click in the Gutter
1. Open `apps/frontend/src/viewer/Viewer.tsx`
2. Find line 801 (your `createAnnotationAtPoint` function)
3. Click in the left margin next to the line number
4. A red dot will appear indicating a breakpoint

### Method 2: Use F9
1. Place your cursor on the line you want to break
2. Press `F9` to toggle breakpoint

### Method 3: Conditional Breakpoints
1. Right-click in the gutter
2. Select "Add Conditional Breakpoint"
3. Enter condition like `lng > 0 && lat > 0`

## Debugging Your Function

### Step-by-Step Debugging
1. **Set breakpoint** on line 801 (function start)
2. **Set breakpoint** on line 802 (early return check)
3. **Set breakpoint** on line 826 (tempId creation)
4. **Set breakpoint** on line 849 (state update)

### Debug Controls
- **F10**: Step Over (execute current line)
- **F11**: Step Into (enter function calls)
- **Shift+F11**: Step Out (exit current function)
- **F5**: Continue execution
- **Shift+F5**: Stop debugging

### Inspecting Variables
- **Hover** over variables to see their values
- **Watch panel**: Add variables to watch list
- **Debug console**: Type expressions to evaluate
- **Call stack**: See function call hierarchy

## Common Issues & Solutions

### Issue: Breakpoints Not Hit
**Solution**: 
- Ensure dev server is running (`npm run dev`)
- Check that source maps are enabled
- Try refreshing the browser
- Clear browser cache

### Issue: Source Maps Not Working
**Solution**:
- Check `vite.config.ts` has `sourcemap: true`
- Restart dev server after config changes
- Check browser DevTools → Sources tab

### Issue: Variables Show as Undefined
**Solution**:
- Variables might be optimized away
- Try adding `console.log()` statements
- Check if variable is in scope

## Advanced Debugging

### Debug Console Commands
```javascript
// Inspect current state
allRef.current
selectedLayerId
isCreateModeRef.current

// Check map state
map.current?.getCenter()
map.current?.getZoom()

// Evaluate expressions
lng + lat
ring.length
tempId
```

### Network Debugging
1. Open Chrome DevTools (`F12`)
2. Go to Network tab
3. Filter by "XHR" or "Fetch"
4. Watch API calls to `/api/features/`

### React DevTools
1. Install React DevTools browser extension
2. Open DevTools → Components tab
3. Inspect component state and props
4. See state changes in real-time

## Debugging Workflow

### 1. Reproduce the Issue
- Enter password 'martin'
- Select a layer
- Press 'C' to enter create mode
- Click on map

### 2. Set Strategic Breakpoints
```javascript
// Line 802: Check if function is called
if (!map.current || !selectedLayerId) return;

// Line 826: Check temp ID generation
const tempId = `temp_${Date.now()}`;

// Line 849: Check state update
const updatedAll = [...allRef.current, newAnnotation];
```

### 3. Inspect Key Variables
- `lng`, `lat`: Click coordinates
- `selectedLayerId`: Current layer
- `map.current`: Map instance
- `ring`: Generated polygon coordinates
- `tempId`: Generated temporary ID

### 4. Check State Updates
- `allRef.current`: Current annotations
- `updatedAll`: New state array
- `setAll(updatedAll)`: State setter call

## Troubleshooting

### Function Not Called
- Check if `isCreateModeRef.current` is true
- Verify click event handler is attached
- Check console for errors

### State Not Updating
- Verify `setAll()` is called
- Check if `allRef.current` is updated
- Look for React re-render issues

### Map Issues
- Check if `map.current` exists
- Verify map is fully loaded
- Check for coordinate system issues

## Tips

1. **Use console.log()** for quick debugging
2. **Set multiple breakpoints** to trace execution flow
3. **Watch the Call Stack** to understand function calls
4. **Use the Debug Console** to test expressions
5. **Check Network tab** for API calls
6. **Use React DevTools** for component state

## Example Debug Session

1. Set breakpoint on line 801
2. Click "Create Annotation" button
3. Click on map
4. Debugger should stop at line 801
5. Step through with F10
6. Inspect variables at each step
7. Continue with F5 when done

Happy debugging! 🐛
