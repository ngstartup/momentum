import {
  Activity, Apple, Award, BookOpen, Brain, Briefcase, Code, Coffee, Droplets, Dumbbell, Flame, GraduationCap,
  Heart, Languages, Leaf, Moon, Music, Palette, PenLine, PiggyBank, Pill, Shapes, Sprout, Star, Sun, Target,
  TrendingUp, Users, Wallet, Bike, Footprints, type LucideIcon,
} from 'lucide-react'

export const ICONS: Record<string, LucideIcon> = {
  'book-open': BookOpen, code: Code, dumbbell: Dumbbell, 'trending-up': TrendingUp, moon: Moon, droplets: Droplets,
  brain: Brain, heart: Heart, sun: Sun, coffee: Coffee, apple: Apple, bike: Bike, footprints: Footprints,
  pill: Pill, music: Music, palette: Palette, 'pen-line': PenLine, languages: Languages, leaf: Leaf,
  target: Target, star: Star, flame: Flame, activity: Activity, 'piggy-bank': PiggyBank, award: Award,
  'graduation-cap': GraduationCap, briefcase: Briefcase, wallet: Wallet, sprout: Sprout, users: Users, shapes: Shapes,
}

export const HABIT_ICON_CHOICES = [
  'book-open', 'code', 'dumbbell', 'trending-up', 'moon', 'droplets', 'brain', 'heart', 'sun', 'coffee', 'apple',
  'bike', 'footprints', 'pill', 'music', 'palette', 'pen-line', 'languages', 'leaf', 'target', 'star', 'flame',
  'activity', 'piggy-bank',
]

export const COLOR_CHOICES = [
  '#D8B56D', '#8FAF9A', '#7FA6D8', '#C79BD8', '#E39B7B', '#D88FA6', '#9FD8CF', '#E5786D', '#B8C46E', '#9CA3AF',
]

export function HabitIcon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const I = ICONS[name] ?? Target
  return <I size={size} color={color} aria-hidden />
}
