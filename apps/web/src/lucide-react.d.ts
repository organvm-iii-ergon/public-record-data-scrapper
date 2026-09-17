// Type declarations for lucide-react icon imports
declare module 'lucide-react/dist/esm/icons/*' {
  import { ForwardRefExoticComponent, SVGProps, RefAttributes } from 'react'

  export interface IconProps extends Partial<Omit<SVGProps<SVGSVGElement>, 'stroke'>> {
    size?: string | number
    absoluteStrokeWidth?: boolean
  }

  export type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>

  const icon: Icon
  export default icon
}
