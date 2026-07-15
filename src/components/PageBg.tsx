export default function PageBg({ src, opacity = 0.50, children }: { src: string; opacity?: number; children: React.ReactNode }) {
  return (
    <div className="page-bg">
      <div className="page-bg-img">
        <img src={src} alt="" />
      </div>
      <div className="page-bg-overlay" style={{ background: `rgba(10, 10, 10, ${opacity})` }} />
      <div className="page-content">
        {children}
      </div>
    </div>
  )
}
