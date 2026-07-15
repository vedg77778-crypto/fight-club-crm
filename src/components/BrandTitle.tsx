type BrandTitleProps = {
  align?: 'left' | 'center'
  size?: 'sm' | 'md' | 'lg'
  showLocation?: boolean
  className?: string
}

export default function BrandTitle({
  align = 'left',
  size = 'lg',
  showLocation = false,
  className = '',
}: BrandTitleProps) {
  return (
    <div className={`brand-title brand-title--${align} brand-title--${size} ${className}`}>
      <p className="brand-title__coach">Coach Somnath's</p>
      <h1 className="brand-title__park">LODHA PARK</h1>
      <p className="brand-title__fight">FIGHT CLUB</p>
      <span className="brand-title__rope" aria-hidden>
        <i />
      </span>
      {showLocation && <p className="brand-title__loc">LOWER PAREL · MUMBAI</p>}
    </div>
  )
}
