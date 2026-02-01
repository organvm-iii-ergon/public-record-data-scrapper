import { Moon, Sun, Palette, Leaf, Terminal } from '@phosphor-icons/react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

const themes = [
  {
    id: 'dark-professional',
    label: 'Dark Professional',
    icon: Moon,
    description: 'Clean dark SaaS style'
  },
  { id: 'light-clean', label: 'Light Clean', icon: Sun, description: 'Bright business dashboard' },
  { id: 'dark-green', label: 'Dark Green', icon: Leaf, description: 'Finance/trading aesthetic' },
  {
    id: 'current-fixed',
    label: 'Purple Classic',
    icon: Palette,
    description: 'Purple with better contrast'
  },
  { id: 'hacker', label: 'Hacker', icon: Terminal, description: 'Terminal/matrix style' }
]

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  const currentTheme = themes.find((t) => t.id === theme) || themes[0]
  const Icon = currentTheme.icon
  const handleToggle = () => {
    const nextTheme = theme === 'light-clean' ? 'dark-professional' : 'light-clean'
    setTheme(nextTheme)
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      themes.forEach(({ id }) => root.classList.remove(id))
      root.classList.add(nextTheme)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Toggle theme"
          data-testid="theme-toggle"
          variant="outline"
          size="sm"
          className="glass-effect border-white/30 text-white hover:bg-white/10"
          onPointerDown={handleToggle}
        >
          <Icon size={16} weight="bold" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-effect border-white/30 min-w-[200px]">
        {themes.map(({ id, label, icon: ThemeIcon, description }) => (
          <DropdownMenuItem
            key={id}
            onClick={() => setTheme(id)}
            className={theme === id ? 'bg-white/10' : ''}
          >
            <ThemeIcon size={16} weight="bold" className="mr-2" />
            <div className="flex flex-col">
              <span>{label}</span>
              <span className="text-xs text-muted-foreground">{description}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
