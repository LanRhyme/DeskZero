import { cn } from '@/utils/cn'

interface DesktopGridProps {
  children: React.ReactNode
}

export function DesktopGrid({ children }: DesktopGridProps) {
  return (
    <div className={cn("w-full h-full absolute inset-0 z-0")}>
      {children}
    </div>
  )
}
