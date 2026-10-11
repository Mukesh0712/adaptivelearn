import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// A plain value/label dropdown on top of the Base UI Select.
export function SimpleSelect<T extends string>({
  id,
  value,
  onChange,
  items,
  invalid,
  describedBy,
  disabled,
}: {
  id: string
  value: T
  onChange: (value: T) => void
  items: { value: T; label: string }[]
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v !== null && onChange(v as T)}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid} aria-describedby={describedBy} disabled={disabled}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
