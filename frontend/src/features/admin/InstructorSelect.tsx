import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useListUsersQuery } from './adminApi'

// Dropdown of ACTIVE instructors (the only ones a course can be given to).
// Loads up to 50, which is plenty for one institute.
export function InstructorSelect({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  excludeId,
}: {
  id: string
  value: string
  onChange: (id: string) => void
  invalid?: boolean
  describedBy?: string
  excludeId?: string // e.g. the course's current instructor
}) {
  const { data, isLoading } = useListUsersQuery({ role: 'instructor', status: 'active', page: 1, pageSize: 50 })
  const items = (data?.users ?? [])
    .filter((u) => u.id !== excludeId)
    .map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))

  return (
    <Select items={items} value={value || null} onValueChange={(v) => onChange((v as string | null) ?? '')}>
      <SelectTrigger
        id={id}
        className="w-full"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        disabled={isLoading || items.length === 0}
      >
        <SelectValue placeholder={isLoading ? 'Loading instructors…' : items.length ? 'Choose an instructor' : 'No active instructors'} />
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
