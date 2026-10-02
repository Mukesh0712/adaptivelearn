import { useEffect, useState } from 'react'

// Returns `value`, but only after it has stopped changing for `delay` ms.
// Used for search boxes: typing "alice" sends one request, not five.
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
