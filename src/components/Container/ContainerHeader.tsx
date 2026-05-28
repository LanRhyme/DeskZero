interface Props {
  name: string
  onMouseDown: (e: React.MouseEvent) => void
}

export default function ContainerHeader({ name, onMouseDown }: Props) {
  return (
    <div
      className="flex items-center px-3 py-2 cursor-move shrink-0"
      style={{
        color: 'var(--color-text)',
        borderBottom: '1px solid var(--color-border)',
      }}
      onMouseDown={onMouseDown}
    >
      <span className="text-sm font-medium truncate">{name}</span>
    </div>
  )
}
