import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import campus1 from "@/assets/campus-1.webp"
import campus2 from "@/assets/campus-2.jpeg"
import campus3 from "@/assets/campus-3.jpg"

const SLIDES = [campus1, campus2, campus3]
const INTERVAL_MS = 5000

export function CampusSlideshow() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % SLIDES.length), INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#062841]">
      {SLIDES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out",
            i === active ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      <div className="absolute inset-0 bg-linear-to-t from-[#062841]/90 via-[#062841]/10 to-[#062841]/30" />

      <div className="absolute right-0 bottom-0 left-0 p-10">
        <p className="text-2xl font-semibold text-white">Where your research begins.</p>
        <p className="mt-1 text-sm text-white/70">University of Sunderland campus</p>
        <div className="mt-5 flex gap-1.5">
          {SLIDES.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
