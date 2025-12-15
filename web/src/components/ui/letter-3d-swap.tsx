"use client"

import React, {
  useCallback,
  useMemo,
  type ElementType,
  type HTMLAttributes,
} from "react"
import {
  useAnimate,
  type ValueAnimationTransition,
} from "motion/react"
import { cn } from "../../lib/utils"

type WordObject = {
  characters: string[]
  needsSpace: boolean
}

const splitIntoCharacters = (text: string): string[] => {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
    return Array.from(segmenter.segment(text), ({ segment }) => segment)
  }
  return Array.from(text)
}

export type Letter3DSwapProps = {
  children: string
  as?: ElementType
  mainClassName?: string
  frontFaceClassName?: string
  secondFaceClassName?: string
  staggerDuration?: number
  staggerFrom?: "first" | "last" | "center" | "random" | number
  transition?: ValueAnimationTransition
  rotateDirection?: "top" | "right" | "bottom" | "left"
} & HTMLAttributes<HTMLElement>

export function Letter3DSwap({
  children,
  as: Component = "p",
  mainClassName,
  frontFaceClassName,
  secondFaceClassName,
  staggerDuration = 0.05,
  staggerFrom = "first",
  transition = { type: "spring", damping: 25, stiffness: 300 },
  rotateDirection = "top",
  ...rest
}: Letter3DSwapProps) {
  const [scope, animate] = useAnimate()

  const words: WordObject[] = useMemo(() => {
    const t = children.split(" ")
    return t.map((word: string, i: number) => ({
      characters: splitIntoCharacters(word),
      needsSpace: i !== t.length - 1,
    }))
  }, [children])

  const totalChars = useMemo(
    () => words.reduce((acc, word) => acc + word.characters.length, 0),
    [words]
  )

  const getStaggerDelay = useCallback(
    (index: number, totalChars: number) => {
      const total = totalChars
      if (staggerFrom === "first") return index * staggerDuration
      if (staggerFrom === "last") return (total - 1 - index) * staggerDuration
      if (staggerFrom === "center") {
        const center = Math.floor(total / 2)
        return Math.abs(center - index) * staggerDuration
      }
      if (staggerFrom === "random") {
        const randomIndex = Math.floor(Math.random() * total)
        return Math.abs(randomIndex - index) * staggerDuration
      }
      return Math.abs(staggerFrom - index) * staggerDuration
    },
    [staggerFrom, staggerDuration]
  )

  const handleAnimation = useCallback(async () => {
    const delays: number[] = []
    let charIndex = 0
    words.forEach((word) => {
      word.characters.forEach(() => {
        delays.push(getStaggerDelay(charIndex, totalChars))
        charIndex++
      })
    })

    const rotationTransform =
      rotateDirection === "top"
        ? "rotateX(-90deg)"
        : rotateDirection === "bottom"
          ? "rotateX(90deg)"
          : rotateDirection === "left"
            ? "rotateY(90deg)"
            : "rotateY(-90deg)"

    await animate(
      ".letter-3d-swap-char-box-item",
      { transform: rotationTransform },
      {
        ...transition,
        delay: (i: number) => delays[i],
      }
    )

    await animate(
      ".letter-3d-swap-char-box-item",
      { transform: "rotateX(0deg) rotateY(0deg)" },
      { duration: 0 }
    )
  }, [animate, getStaggerDelay, rotateDirection, totalChars, transition, words])

  const getTransformStyle = useCallback(() => {
    switch (rotateDirection) {
      case "top":
      case "bottom":
        return {
          frontFace: "translateZ(0.5lh)",
          secondFace:
            rotateDirection === "top"
              ? "rotateX(90deg) translateZ(0.5lh)"
              : "rotateX(-90deg) translateZ(0.5lh)",
          box: "translateZ(-0.5lh)",
        }
      case "left":
      case "right":
        return {
          frontFace:
            "rotateY(90deg) translateX(50%) rotateY(-90deg) translateX(-50%)",
          secondFace:
            rotateDirection === "left"
              ? "rotateY(90deg) translateX(50%) rotateY(-90deg) translateX(-50%) rotateY(-90deg) translateX(50%)"
              : "rotateY(90deg) translateX(50%) rotateY(-90deg) translateX(-50%) rotateY(90deg) translateX(-50%)",
          box: "rotateY(-90deg) translateX(-50%) rotateY(90deg)",
        }
    }
  }, [rotateDirection])

  const transformStyle = getTransformStyle()

  return (
    <Component
      ref={scope}
      className={cn(
        // Perspective
        "[perspective:1000px]",
        mainClassName
      )}
      onMouseEnter={handleAnimation}
      {...rest}
    >
      {words.map((word, wordIndex) => (
        <span
          key={wordIndex}
          className={cn(
            // Display
            "inline-flex"
          )}
        >
          {word.characters.map((char, charIndex) => (
            <span
              key={charIndex}
              className={cn(
                // Display
                "inline-block",
                // 3D
                "[transform-style:preserve-3d]",
                // Animation
                "letter-3d-swap-char-box-item"
              )}
              style={{ transform: transformStyle.box }}
            >
              {/* Front face */}
              <span
                className={cn(
                  // Display
                  "inline-block",
                  // Backface
                  "[backface-visibility:hidden]",
                  frontFaceClassName
                )}
                style={{ transform: transformStyle.frontFace }}
              >
                {char}
              </span>
              {/* Second face */}
              <span
                className={cn(
                  // Position
                  "absolute inset-0",
                  // Display
                  "inline-block",
                  // Backface
                  "[backface-visibility:hidden]",
                  secondFaceClassName
                )}
                style={{ transform: transformStyle.secondFace }}
              >
                {char}
              </span>
            </span>
          ))}
          {word.needsSpace && <span>&nbsp;</span>}
        </span>
      ))}
    </Component>
  )
}

