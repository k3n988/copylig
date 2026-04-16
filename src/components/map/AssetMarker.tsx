'use client'

// src/components/map/AssetMarker.tsx



import { Marker, InfoWindow } from '@vis.gl/react-google-maps'

import type { Asset } from '@/types'



interface Props {

asset: Asset

isOpen: boolean

onOpen: () => void

onClose: () => void

}



const STATUS_COLOR: Record<Asset['status'], string> = {

Active: '#238636',

Dispatching: '#f39c12',

Standby: '#8b949e',

}



/** Renders an emoji inside an SVG data-URI icon — no mapId required. */

function emojiIcon(emoji: string) {

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">

<text x="2" y="30" font-size="28"

font-family="Apple Color Emoji,Segoe UI Emoji,NotoColorEmoji,sans-serif">${emoji}</text>

</svg>`

// btoa via encodeURIComponent handles multi-byte emoji safely

return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`

}



export default function AssetMarker({ asset, isOpen, onOpen, onClose }: Props) {

const pos = { lat: asset.lat, lng: asset.lng }



return (

<>

<Marker

position={pos}

icon={emojiIcon(asset.icon)}

title={asset.name}

onClick={onOpen}

/>



{isOpen && (

<InfoWindow

position={pos}

onCloseClick={onClose}

headerDisabled={true}

>

<style>{`

.gm-style-iw-c { padding: 0 !important; overflow: hidden !important; background: #161b22 !important; }

.gm-style-iw-d { overflow: hidden !important; padding: 0 !important; max-height: none !important; }

`}</style>

<div

style={{

fontFamily: 'Inter, sans-serif',

minWidth: 180,

background: '#161b22',

color: '#c9d1d9',

padding: '12px',

position: 'relative'

}}

>

<button

onClick={onClose}

style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '1rem' }}

>

✕

</button>



<div style={{ fontWeight: 'bold', marginBottom: 4, color: '#fff' }}>

{asset.icon} {asset.name}

</div>

<div style={{ fontSize: '0.8rem', color: '#8b949e', marginBottom: 8 }}>

{asset.type} — {asset.unit}

</div>

<div

style={{

color: STATUS_COLOR[asset.status],

fontSize: '0.75rem',

fontWeight: 'bold',

}}

>

• {asset.status.toUpperCase()}

</div>

</div>

</InfoWindow>

)}

</>

)

}