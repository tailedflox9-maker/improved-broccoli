"use client"

import { useState } from "react"
import { PostCanvas } from "@/components/post-canvas"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus, Download, ImageIcon, Copy, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface Section {
  id: string
  type: "title" | "label-box" | "text-box" | "image"
  content: string
  style?: {
    backgroundColor?: string
    textColor?: string
    fontSize?: string
  }
}

export interface Slide {
  id: string
  sections: Section[]
  author: string
  background: string
}

const BACKGROUNDS = {
  white: { name: "Clean White", value: "#ffffff", isDark: false },
  cream: { name: "Warm Cream", value: "#fef9f3", isDark: false },
  lightGray: { name: "Light Gray", value: "#f5f5f5", isDark: false },
  grainy: { name: "Grainy Texture", value: "#f8f8f8", isDark: false },
  dots: { name: "Subtle Dots", value: "#fafafa", isDark: false },
  darkGray: { name: "Dark Gray", value: "#1f2937", isDark: true },
  darkBlue: { name: "Dark Blue", value: "#1e3a8a", isDark: true },
  black: { name: "Black", value: "#0a0a0a", isDark: true },
}

export default function Home() {
  const [slides, setSlides] = useState<Slide[]>([
    {
      id: "1",
      sections: [
        {
          id: "1",
          type: "title",
          content: "YOUR POST TITLE HERE",
          style: { fontSize: "48px" },
        },
        {
          id: "2",
          type: "label-box",
          content: "Section Label",
          style: { backgroundColor: "#3B82F6", textColor: "#FFFFFF" },
        },
        {
          id: "3",
          type: "text-box",
          content: "Add your main content here. Click to edit any text.",
        },
      ],
      author: "Your Name",
      background: "white",
    },
  ])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)

  const currentSlide = slides[currentSlideIndex]

  const updateSection = (sectionId: string, content: string) => {
    const updatedSlide = {
      ...currentSlide,
      sections: currentSlide.sections.map((s) => (s.id === sectionId ? { ...s, content } : s)),
    }
    setSlides(slides.map((s, i) => (i === currentSlideIndex ? updatedSlide : s)))
  }

  const updateAuthor = (author: string) => {
    const updatedSlide = { ...currentSlide, author }
    setSlides(slides.map((s, i) => (i === currentSlideIndex ? updatedSlide : s)))
  }

  const moveSection = (sectionId: string, direction: "up" | "down") => {
    const index = currentSlide.sections.findIndex((s) => s.id === sectionId)
    if ((direction === "up" && index === 0) || (direction === "down" && index === currentSlide.sections.length - 1)) {
      return
    }

    const newSections = [...currentSlide.sections]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    ;[newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]]

    const updatedSlide = { ...currentSlide, sections: newSections }
    setSlides(slides.map((s, i) => (i === currentSlideIndex ? updatedSlide : s)))
  }

  const addSection = (type: Section["type"]) => {
    const isDark = BACKGROUNDS[currentSlide.background as keyof typeof BACKGROUNDS]?.isDark
    const labelColor = isDark ? "#10b981" : "#3B82F6"

    const newSection: Section = {
      id: Date.now().toString(),
      type,
      content: type === "label-box" ? "New Label" : type === "image" ? "" : "New content here",
      style: type === "label-box" ? { backgroundColor: labelColor, textColor: "#FFFFFF" } : {},
    }
    const updatedSlide = {
      ...currentSlide,
      sections: [...currentSlide.sections, newSection],
    }
    setSlides(slides.map((s, i) => (i === currentSlideIndex ? updatedSlide : s)))
  }

  const deleteSection = (sectionId: string) => {
    const updatedSlide = {
      ...currentSlide,
      sections: currentSlide.sections.filter((s) => s.id !== sectionId),
    }
    setSlides(slides.map((s, i) => (i === currentSlideIndex ? updatedSlide : s)))
  }

  const updateBackground = (background: string) => {
    const isDark = BACKGROUNDS[background as keyof typeof BACKGROUNDS]?.isDark
    const newLabelColor = isDark ? "#10b981" : "#3B82F6"

    const updatedSections = currentSlide.sections.map((section) => {
      if (section.type === "label-box") {
        return {
          ...section,
          style: {
            ...section.style,
            backgroundColor: newLabelColor,
            textColor: "#FFFFFF",
          },
        }
      }
      return section
    })

    const updatedSlide = { ...currentSlide, background, sections: updatedSections }
    setSlides(slides.map((s, i) => (i === currentSlideIndex ? updatedSlide : s)))
  }

  const addSlide = () => {
    const newSlide: Slide = {
      id: Date.now().toString(),
      sections: [
        {
          id: Date.now().toString(),
          type: "title",
          content: "NEW SLIDE TITLE",
          style: { fontSize: "48px" },
        },
      ],
      author: currentSlide.author,
      background: "white",
    }
    setSlides([...slides, newSlide])
    setCurrentSlideIndex(slides.length)
  }

  const duplicateSlide = () => {
    const duplicated: Slide = {
      ...currentSlide,
      id: Date.now().toString(),
      sections: currentSlide.sections.map((s) => ({
        ...s,
        id: Date.now().toString() + Math.random(),
      })),
    }
    const newSlides = [...slides]
    newSlides.splice(currentSlideIndex + 1, 0, duplicated)
    setSlides(newSlides)
    setCurrentSlideIndex(currentSlideIndex + 1)
  }

  const deleteSlide = () => {
    if (slides.length === 1) return
    const newSlides = slides.filter((_, i) => i !== currentSlideIndex)
    setSlides(newSlides)
    setCurrentSlideIndex(Math.min(currentSlideIndex, newSlides.length - 1))
  }

  const exportSlide = async () => {
    const html2canvas = (await import("html2canvas")).default
    const element = document.getElementById("post-canvas")
    if (!element) return

    const bgColor = BACKGROUNDS[currentSlide.background as keyof typeof BACKGROUNDS]?.value || "#ffffff"

    const canvas = await html2canvas(element, {
      backgroundColor: bgColor,
      scale: 3,
      logging: false,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 0,
      removeContainer: true,
    })

    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a")
        link.download = `slide-${currentSlideIndex + 1}.png`
        link.href = URL.createObjectURL(blob)
        link.click()
        URL.revokeObjectURL(link.href)
      }
    }, "image/png", 1.0)
  }

  const exportAllAsPDF = async () => {
    const html2canvas = (await import("html2canvas")).default
    const jsPDF = (await import("jspdf")).default
    const element = document.getElementById("post-canvas")
    if (!element) return

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [1080, 1080],
    })

    for (let i = 0; i < slides.length; i++) {
      setCurrentSlideIndex(i)
      await new Promise((resolve) => setTimeout(resolve, 500))

      const bgColor = BACKGROUNDS[slides[i].background as keyof typeof BACKGROUNDS]?.value || "#ffffff"

      const canvas = await html2canvas(element, {
        backgroundColor: bgColor,
        scale: 3,
        logging: false,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 0,
      })

      const imgData = canvas.toDataURL("image/png", 1.0)
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, "PNG", 0, 0, 1080, 1080)
    }

    pdf.save("carousel-post.pdf")
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card p-6 shadow-lg">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Post Generator</h1>
            <p className="text-sm text-muted-foreground mt-1">Create stunning carousel posts</p>
          </div>

          {/* Background Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Background Style</label>
            <Select value={currentSlide.background} onValueChange={updateBackground}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BACKGROUNDS).map(([key, { name }]) => (
                  <SelectItem key={key} value={key}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add Elements */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Add Elements</label>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => addSection("label-box")} variant="outline" size="sm" className="w-full">
                <Plus className="mr-1 h-3 w-3" />
                Label
              </Button>
              <Button onClick={() => addSection("text-box")} variant="outline" size="sm" className="w-full">
                <Plus className="mr-1 h-3 w-3" />
                Text
              </Button>
              <Button onClick={() => addSection("image")} variant="outline" size="sm" className="w-full col-span-2">
                <ImageIcon className="mr-1 h-3 w-3" />
                Image
              </Button>
            </div>
          </div>

          {/* Slide Controls */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Slide Actions</label>
            <div className="space-y-2">
              <Button onClick={addSlide} variant="outline" size="sm" className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                New Slide
              </Button>
              <Button onClick={duplicateSlide} variant="outline" size="sm" className="w-full">
                <Copy className="mr-2 h-4 w-4" />
                Duplicate Slide
              </Button>
              {slides.length > 1 && (
                <Button onClick={deleteSlide} variant="outline" size="sm" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Slide
                </Button>
              )}
            </div>
          </div>

          {/* Export */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Export</label>
            <div className="space-y-2">
              <Button onClick={exportSlide} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Export PNG
              </Button>
              <Button onClick={exportAllAsPDF} variant="secondary" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Export All as PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation */}
        <div className="border-b border-border bg-card px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                disabled={currentSlideIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <div className="text-sm font-medium text-foreground">
                  Slide {currentSlideIndex + 1} of {slides.length}
                </div>
                <div className="text-xs text-muted-foreground">Click any text to edit</div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
                disabled={currentSlideIndex === slides.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl">
            <PostCanvas
              slide={currentSlide}
              onUpdateSection={updateSection}
              onUpdateAuthor={updateAuthor}
              onDeleteSection={deleteSection}
              onMoveSection={moveSection}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
