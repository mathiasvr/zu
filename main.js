const Tau = 2 * Math.PI

export class Drawing {
  /**
   * @param {CanvasRenderingContext2D} context
   */
  constructor (context) {
    /** Canvas rendering context */
    this._ = context

    /**
     * Current position used for drawing.
     * @type {{x: number, y: number}}
     * @private
     */
    this.pos = { x: 0, y: 0 }

    /**
     * Whether the current position has already been used for drawing.
     * @private
     */
    this.posDrawn = true

    /** @private */
    this.posStart = null // current path starting position (used for closing and splitting paths)

    /**
     * @type {[string, typeof Drawing.prototype.pos, typeof Drawing.prototype.textStyle][]}
     * @private
     */
    this.pendingText = []

    /**
     * @type {{font?: string, textAlign?: CanvasTextAlign, textBaseline?: CanvasTextBaseline}}
     * @private
     */
    this.textStyle = {}

    /** @private */
    this.pendingPathClose = false

    /**
     * Function for drawing a curve with end point (x, y)
     * @type {((x: number, y: number) => void)?}
     * @private
     */
    this.drawCurve = null
  }

  // --------------- Internal Path Management ---------------

  /**
   * Move or draw line to next position
   * @param {number} [x]
   * @param {number} [y]
   * @private
   */
  _advancePath (x, y) {
    if (!this.posDrawn) {
      if (this.posStart == null) {
        this.posStart = { ...this.pos }
        this._.moveTo(this.pos.x, this.pos.y)
      } else {
        this._.lineTo(this.pos.x, this.pos.y)
      }
    }

    if (x != null && y != null) {
      this.pos = { x, y }
      this.posDrawn = false
    } else {
      this.posDrawn = true
    }
  }

  /** @private */
  _checkPathClose () {
    // check if stroke() or fill() has been called, which should trigger a new path
    if (this.pendingPathClose) {
      this.pendingPathClose = false
      this.pendingText = []

      this._.beginPath()
      this.posStart = null
    }
  }

  // --------------- Points, Paths and Shapes ---------------

  /**
   * Add point or set current position
   * @param {number|function} x
   * @param {number} [y]
   */
  xy (x, y) {
    this._checkPathClose()

    if (typeof x === 'function') return this._xyf(x)

    this._advancePath(x, y)

    if (this.drawCurve) {
      this.drawCurve(this.pos.x, this.pos.y)
      this.drawCurve = null
      // todo: currently allow arc curve to join end point
      // this.posDrawn = true
    }

    return this
  }

  /**
   * Add point changing only the x-coordinate
   * @param {number} x
   */
  x (x) { return this.xy(x, this.pos.y) }

  /**
   * Add point changing only the y-coordinate
   * @param {number} y
   */
  y (y) { return this.xy(this.pos.x, y) }

  /**
   * Add point relative to current position
   * @param {number} x
   * @param {number} y
   */
  dxy (x, y) { return this.xy(this.pos.x + x, this.pos.y + y) }

  /**
   * Add point relative to current position changing only the x-coordinate
   * @param {number} x
   */
  dx (x) { return this.dxy(x, 0) }

  /**
   * Add point relative to current position changing only the y-coordinate
   * @param {number} y
   */
  dy (y) { return this.dxy(0, y) }

  /**
   *
   * @param {function} func
   * @private
   */
  _xyf (func) {
    for (const [x, y] of func()) {
      this._advancePath(x, y)
    }
    return this
  }

  /**
   * Close current path
   */
  close () {
    this._checkPathClose()

    this._advancePath()

    if (this.posStart) {
      this.xy(this.posStart.x, this.posStart.y)
      this._advancePath()
      this.posStart = null
    }

    this._.closePath()

    return this
  }

  /**
   * Draw rectangle
   * @param {number} width
   * @param {number} height
   * @param {boolean} [centered]
   */
  rect (width, height, centered) {
    this._checkPathClose()

    const { x, y } = this.pos

    this._.rect(
      centered ? x - width / 2 : x,
      centered ? y - height / 2 : y,
      width, height)

    this.posDrawn = true
    return this
  }

  /**
   * Draw square
   * @param {number} size
   * @param {boolean} [centered]
   */
  square (size, centered) {
    return this.rect(size, size, centered)
  }

  /**
   * Draw arc
   * @param {number} radius
   * @param {number} startAngle
   * @param {number} endAngle
   * @param {boolean} [anticlockwise]
   */
  arc (radius, startAngle, endAngle, anticlockwise) {
    this._checkPathClose()

    this._.arc(
      this.pos.x,
      this.pos.y,
      radius,
      startAngle, endAngle,
      anticlockwise)

    this.posDrawn = true
    return this
  }

  /**
   * Draw circle
   * @param {number} radius
   */
  circle (radius) {
    this._.moveTo(this.pos.x + radius, this.pos.y)

    this.arc(radius, 0, Tau, false)

    this.posStart = null // split path

    return this
  }

  /**
   * Draw Ellipse
   * @param {number} radiusX
   * @param {number} radiusY
   * @param {number} [rotation]
   * @param {number} [startAngle]
   * @param {number} [endAngle]
   * @param {boolean} [anticlockwise]
   */
  ellipse (radiusX, radiusY, rotation = 0, startAngle = 0, endAngle = Tau, anticlockwise) {
    this._checkPathClose()

    const { x, y } = this.pos

    if (startAngle === 0 && endAngle === Tau) {
      this._.moveTo(x + radiusX * Math.cos(rotation), y + radiusX * Math.sin(rotation))
    }

    this._.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise)

    this.posDrawn = true
    return this
  }

  /**
   * Add arc to path
   * @param {number} x Control point x coordinate
   * @param {number} y Control point y coordinate
   * @param {number} radius
   */
  arcTo (x, y, radius) {
    this.drawCurve = (x2, y2) => this._.arcTo(x, y, x2, y2, radius)

    return this
  }

  /**
   * Add Bézier curve to current path
   * @param {number} x1 Control point 1 x coordinate
   * @param {number} y1 Control point 1 y coordinate
   * @param {number} [x2] Control point 2 x coordinate
   * @param {number} [y2] Control point 2 y coordinate
   */
  curve (x1, y1, x2, y2) {
    this.drawCurve = x2 != null && y2 != null
      ? (x, y) => this._.bezierCurveTo(x1, y1, x2, y2, x, y)
      : (x, y) => this._.quadraticCurveTo(x1, y1, x, y)

    return this
  }

  // --------------- Path Manipulation ---------------

  /**
   * Split current path
   */
  split () {
    this._checkPathClose()

    this._advancePath()
    this.posStart = null

    return this
  }

  /**
   * Join current path with next shape, etc.
   */
  join () {
    this._checkPathClose()

    this._advancePath()
    // duplicate last position
    this.xy(this.pos.x, this.pos.y)

    return this
  }

  // --------------- Drawing ---------------

  /**
   * Stroke outline of current path and shapes
   * @param {number | (string | CanvasGradient | CanvasPattern)} [size]
   * @param {string | CanvasGradient | CanvasPattern} [color]
   */
  stroke (size, color) {
    if (typeof size === 'number') {
      this._.lineWidth = size
      if (color) this._.strokeStyle = color
    } else {
      if (size) this._.strokeStyle = size // pass color in first param
    }

    this._advancePath()

    this.pendingText.forEach(([str, pos, style]) => {
      Object.assign(this._, style)
      this._.strokeText(str, pos.x, pos.y)
    })

    this._.stroke()

    this.pendingPathClose = true

    return this
  }

  /**
   * Fill current path and shapes
   * @param {string | CanvasGradient | CanvasPattern} [color]
   * @param {CanvasFillRule} [fillrule]
   */
  fill (color, fillrule) {
    if (color) this._.fillStyle = color

    this._advancePath()

    this.pendingText.forEach(([str, pos, style]) => {
      Object.assign(this._, style)
      this._.fillText(str, pos.x, pos.y)
    })

    this._.fill(fillrule)

    this.pendingPathClose = true

    return this
  }

  /**
   * Clear canvas
   * @param {number} [width]
   * @param {number} [height]
   * @param {number} [x]
   * @param {number} [y]
   */
  clear (width = this._.canvas.width, height = this._.canvas.height, x = 0, y = 0) {
    this._checkPathClose()

    this._.clearRect(x, y, width, height)
    return this
  }

  /**
   * Draw image
   * @param {CanvasImageSource} src
   * @param {number} [width]
   * @param {number} [height]
   */
  image (src, width, height) {
    this._checkPathClose()

    // todo: can take more params
    if (width && height) {
      this._.drawImage(src, this.pos.x, this.pos.y, width, height)
    } else {
      this._.drawImage(src, this.pos.x, this.pos.y)
    }

    this.posDrawn = true

    return this
  }

  // --------------- Style, Color and Text ---------------

  /**
   * Set stroke style to draw dashed lines
   * @param {Iterable<number>|number} [lineDash]
   * @param {number} [offset]
   */
  dash (lineDash, offset = 0) {
    this._.setLineDash(typeof lineDash === 'number' ? [lineDash] : lineDash || [5])
    this._.lineDashOffset = offset
    return this
  }

  /**
   * Set canvas line style
   * @param {CanvasLineCap} cap
   * @param {CanvasLineJoin} join
   */
  lineStyle (cap, join) {
    this._.lineCap = cap
    this._.lineJoin = join

    return this
  }

  /**
   * Set shadow style
   * @param {object} opts       Options
   * @param {number} opts.x     Shadow offset x
   * @param {number} opts.y     Shadow offset y
   * @param {number} opts.blur  Shadow blur
   * @param {string} opts.color Shadow color
   */
  shadow (opts) {
    this._.shadowOffsetX = opts.x
    this._.shadowOffsetY = opts.y
    this._.shadowBlur = opts.blur
    this._.shadowColor = opts.color
    return this
  }

  /**
   * Draw text
   * @param {string} str
   * @param {CanvasTextAlign} [alignment]
   * @param {CanvasTextBaseline} [baseline]
   */
  text (str, alignment, baseline) {
    this._checkPathClose()

    this.textStyle.textAlign = alignment || 'start'
    this.textStyle.textBaseline = baseline || 'alphabetic'
    this.pendingText.push([str, { ...this.pos }, { ...this.textStyle }])

    this.posDrawn = true
    return this
  }

  /**
   * Set text drawing font
   * @param {string} font
   */
  font (font) {
    this.textStyle.font = font
    return this
    // todo: ctx.direction = ltr, rtl, inherit.
  }

  // --------------- Context Transformation ---------------

  save () {
    this._.save()
    return this
  }

  restore () {
    this._.restore()
    return this
  }

  /**
   * @param {number} angle
   */
  rotate (angle) {
    this._.rotate(angle)
    return this
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  scale (x, y) {
    this._.scale(x, y)
    return this
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  translate (x, y) {
    this._.translate(x, y)
    return this
  }
}
