import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban } from 'lucide-react'
import { projects } from '@/components/home/project-data'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { useHashScroll } from '@/hooks/useHashScroll'
import { cn } from '@/lib/utils'

const count = projects.length

function wrapOffset(index: number, active: number) {
  let offset = index - active
  if (offset > count / 2) offset -= count
  if (offset < -count / 2) offset += count
  return offset
}

function pose(offset: number, stageWidth: number) {
  const distance = Math.abs(offset)
  const hidden = distance > 2
  const direction = Math.sign(offset)
  const compact = stageWidth < 640
  const step = (compact ? [0, 0.22, 0.4] : [0, 0.155, 0.28])[Math.min(distance, 2)]
  const scale = (compact ? [1, 0.82, 0.64] : [1, 0.84, 0.66])[Math.min(distance, 2)]
  const rotate = [0, 12, 18][Math.min(distance, 2)]
  return {
    x: hidden ? 0 : direction * stageWidth * step,
    y: 0,
    rotate: hidden ? 0 : direction * rotate,
    scale: hidden ? 0.84 : scale,
    z: hidden ? 0 : 30 - distance * 10,
    hidden,
  }
}

export function Projects() {
  useHashScroll('projects')
  const [active, setActive] = useState(0)
  const [stageWidth, setStageWidth] = useState(1200)
  const stageRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(0)
  const suppressClick = useRef(false)
  const [dragging, setDragging] = useState(false)
  const project = projects[active]
  activeRef.current = active

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const update = () => setStageWidth(node.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  function go(next: number) {
    setActive((next + count) % count)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const startX = event.clientX
    const startIndex = activeRef.current
    let lastStep = 0
    let moved = false
    setDragging(true)

    const move = (ev: globalThis.PointerEvent) => {
      const step = Math.trunc((ev.clientX - startX) / 80)
      if (step === lastStep) return
      lastStep = step
      moved = true
      setActive((((startIndex - step) % count) + count) % count)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragging(false)
      if (moved) suppressClick.current = true
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick.current = false
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      go(active + 1)
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      go(active - 1)
    }
  }

  return (
    <section id="projects" aria-labelledby="projects-title" className="scroll-mt-28 overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
          <header className="mx-auto max-w-3xl text-center">
            <SectionKicker icon={FolderKanban}>Projects & Initiatives</SectionKicker>
            <h2
              id="projects-title"
              className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
            >
              Student Council <span className="text-brand-600">in Action</span>
            </h2>
            <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
              Current initiatives for law students.
            </p>
          </header>
        </Reveal>
      </div>

      <div
        className="relative mt-6 overflow-hidden py-2 sm:mt-8 sm:py-3"
        role="region"
        aria-roledescription="carousel"
        aria-label="Student Council projects"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div
          ref={stageRef}
          className={cn(
            'relative mx-auto h-[clamp(12.5rem,30vw,19.5rem)] max-w-7xl touch-pan-y select-none [perspective:1400px]',
            dragging ? 'cursor-grabbing' : 'cursor-grab',
          )}
          onPointerDown={onPointerDown}
          onClickCapture={onClickCapture}
        >
          <ul className="absolute inset-0">
            {projects.map((item, index) => {
              const offset = wrapOffset(index, active)
              const distance = Math.abs(offset)
              const place = pose(offset, stageWidth)
              return (
                <li
                  key={item.slug}
                  aria-hidden={place.hidden || undefined}
                  className="absolute top-1/2 left-1/2 w-[clamp(8.75rem,22vw,14.5rem)] [transform-style:preserve-3d] motion-reduce:transition-none"
                  style={{
                    transform: `translate(-50%, -50%) translateX(${place.x}px) rotateY(${place.rotate}deg) scale(${place.scale})`,
                    zIndex: place.z,
                    opacity: place.hidden ? 0 : 1,
                    pointerEvents: place.hidden ? 'none' : 'auto',
                    transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease',
                  }}
                >
                  {distance === 0 ? (
                    <Link
                      to={`/projects/${item.slug}`}
                      aria-label={item.label}
                      className="block aspect-[3/4] overflow-hidden rounded-[1.15rem] shadow-[0_24px_40px_-28px_rgba(30,5,65,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    >
                      <img src={item.image} alt="" draggable={false} className="size-full object-cover" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Show ${item.label}`}
                      tabIndex={place.hidden ? -1 : 0}
                      onClick={() => setActive(index)}
                      className="relative block aspect-[3/4] w-full overflow-hidden rounded-[1.15rem] shadow-[0_18px_36px_-24px_rgba(30,5,65,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    >
                      <img src={item.image} alt="" draggable={false} className="size-full object-cover" />
                      <span
                        aria-hidden
                        className={cn('absolute inset-0', distance === 1 ? 'bg-black/20' : 'bg-black/40')}
                      />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="relative z-30 mx-auto mt-5 max-w-md px-6 text-center">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-700 uppercase">
            Project {String(active + 1).padStart(2, '0')}
          </p>
          <p className="mt-1 font-sans text-[clamp(1.35rem,1rem+1vw,1.85rem)] leading-none font-semibold tracking-tight text-brand-950">
            {project.label}
          </p>
        </div>
      </div>
      <div className="h-[clamp(2.5rem,1.6rem+3vw,5rem)]" />
    </section>
  )
}
