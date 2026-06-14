export default function CurveDivider({ bgImage }) {
  const CLIP = `M 0,0 L 480,0 C 440,250 420,500 420,500 C 420,500 450,750 500,1000 L 0,1000 Z`
  const STROKE = `M 480,0 C 440,250 420,500 420,500 C 420,500 450,750 500,1000`
  const STROKE2 = `M 495,0 C 455,250 435,500 435,500 C 435,500 465,750 515,1000`

  return (
    <svg
      style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', overflow:'visible', zIndex:2, pointerEvents:'none' }}
      viewBox="0 0 500 1000"
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id="leftPanelClip" clipPathUnits="userSpaceOnUse">
          <path d={CLIP} />
        </clipPath>
        <linearGradient id="panelGrad" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%"   stopColor="rgb(5,35,20)"  stopOpacity="0.85"/>
          <stop offset="45%"  stopColor="rgb(8,45,25)"  stopOpacity="0.78"/>
          <stop offset="100%" stopColor="rgb(5,35,20)"  stopOpacity="0.88"/>
        </linearGradient>
      </defs>
      <image href={bgImage} x="-5%" y="-5%" width="110%" height="110%"
        preserveAspectRatio="xMidYMid slice" clipPath="url(#leftPanelClip)" />
      <rect x="0" y="0" width="500" height="1000"
        fill="url(#panelGrad)" clipPath="url(#leftPanelClip)" />
      <path d={STROKE} stroke="#eab308" strokeWidth="8"   opacity="0.08" fill="none" vectorEffect="non-scaling-stroke"/>
      <path d={STROKE} stroke="#eab308" strokeWidth="4"   opacity="0.18" fill="none" vectorEffect="non-scaling-stroke"/>
      <path d={STROKE} stroke="#eab308" strokeWidth="1.5" opacity="0.95" fill="none" vectorEffect="non-scaling-stroke"/>
      <path d={STROKE2} stroke="#eab308" strokeWidth="0.8" opacity="0.2" fill="none" vectorEffect="non-scaling-stroke"/>
    </svg>
  )
}