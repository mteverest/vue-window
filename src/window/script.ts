import { Vue, Component, Prop, Inject, Watch } from "vue-property-decorator"
import { DraggableHelper } from "../draggable_helper"
import { ResizableHelper } from "../resizable_helper"
import { WindowStyle } from "../style"
import MyButton from '../button/index.vue'
import { naturalSize, contentSize } from "../dom"
import { ZElement } from "../z_element"
import { windows } from '../windows';


const instances: WindowType[] = []


@Component({
    components: { MyButton }
})
export class WindowType extends Vue {
    @Prop({ type: Boolean, default: true })
    isOpen!: boolean

    @Prop({ type: String, default: '' })
    title!: string

    @Prop({ type: Boolean, default: false })
    closeButton!: boolean

    @Prop({ type: Boolean, default: false })
    resizable!: boolean

    @Prop({ type: Boolean, default: false })
    isScrollable!: boolean

    @Prop({ type: Boolean, default: true })
    activateWhenOpen!: boolean

    @Prop({ type: String, default: 'auto' })
    initialPosition!: string

    @Prop({ type: Number, default: 0 })
    zGroup!: number

    @Inject()
    windowStyle!: WindowStyle

    private zIndex = 'auto'

    draggableHelper!: DraggableHelper
    resizableHelper!: ResizableHelper

    zElement!: ZElement

    mounted() {
        instances.push(this)
        this.isOpen && setPosition(this, this.initialPosition)
        this.draggableHelper = new DraggableHelper(this.titlebarElement(), this.windowElement(), () => this.fixPosition())
        this.setDimension()
        this.resizable && this.initResizeHelper()
        this.zElement = new ZElement(this.zGroup, zIndex => this.zIndex = `${zIndex}`)
        windows.add(this)
    }

    beforeDestroy() {
        windows.delete(this)
        this.zElement.unregister()
        this.resizableHelper && this.resizableHelper.teardown()
        this.draggableHelper.teardown()
        instances.splice(instances.indexOf(this), 1)
    }

    windowElement() {
        return this.$refs.window as HTMLElement
    }

    titlebarElement() {
        return this.$refs.titlebar as HTMLElement
    }

    contentElement() {
        return this.$refs.content as HTMLElement
    }

    activate() {
        this.zElement.raise()
    }

    get styleWindow() {
        return { ...this.windowStyle.window, zIndex: this.zIndex }
    }

    get styleTitlebar() {
        return this.windowStyle.titlebar
    }

    get styleContent() {
        const style = { ...this.windowStyle.content };

        if (this.resizable) {
            style.padding = '0';
        }

        if (this.isScrollable) {
            style.overflow = 'auto';
        }

        return style;
    }

    @Watch('resizable')
    onResizableChange(resizable: boolean) {
        console.error("prop 'resizable' can't be changed")
    }

    @Watch('isOpen')
    onIsOpenChange(isOpen: boolean) {
        if (isOpen && this.activateWhenOpen)
            this.activate()
    }

    @Watch('zGroup')
    onZGroupChange() {
        this.zElement.group = this.zGroup
    }

    fixPosition() {
        const w = this.windowElement()
        const rect = w.getBoundingClientRect()
        if (rect.left < 0) w.style.left = `0px`
        if (rect.top < 0) w.style.top = `0px`
        if (rect.right > window.innerWidth) w.style.left = `${window.innerWidth - rect.width}px`
        if (rect.bottom > window.innerHeight) w.style.top = `${window.innerHeight - rect.height}px`
    }

    @Prop({ type: Number })
    initialWidth?: number

    @Prop({ type: Number })
    initialHeight?: number

    private setDimension() {
        const content = this.contentElement()
        if (this.initialWidth != undefined) content.style.width = `${this.initialWidth}px`
        if (this.initialHeight != undefined) content.style.height = `${this.initialHeight}px`
    }

    @Prop({ type: Number, default: 0 })
    minWidth!: number

    @Prop({ type: Number, default: 0 })
    minHeight!: number

    @Prop({ type: Number })
    maxWidth?: number

    @Prop({ type: Number })
    maxHeight?: number

    private initResizeHelper() {
        const { height: titlebarHeight } = naturalSize(this.titlebarElement())
        this.resizableHelper = new ResizableHelper(this.windowElement(), {
            onResize: () => this.onResize(),
            minWidth: this.minWidth,
            minHeight: this.minHeight + titlebarHeight,
            maxWidth: this.maxWidth,
            maxHeight: this.maxHeight ? this.maxHeight + titlebarHeight : undefined,
        })
    }

    private onResize() {
        // const { width: wWidth, height: wHeight } = this.windowElement().getBoundingClientRect()
        const { width: wWidth, height: wHeight } = contentSize(this.windowElement())
        const { height: tHeight } = this.titlebarElement().getBoundingClientRect()
        const content = this.contentElement()
        content.style.width = `${wWidth}px`
        content.style.height = `${wHeight - tHeight}px`
    }
}


// todo: cleanup
function setPosition(w: WindowType, positionString: string) {
    const el = w.windowElement()
    const { width, height } = naturalSize(el)
    let left: number
    let top: number
    switch (positionString) {
        case 'auto':
            {
                let x = 20
                let y = 50
                let nTries = 0
                do {
                    if (instances.every(j => {
                        if (w == j)
                            return true
                        const { left, top } = j.windowElement().getBoundingClientRect()
                        return distance2(left, top, x, y) > 16
                    })) {
                        break
                    }
                    x = (x + 40) % (window.innerWidth - 200)
                    y = (y + 40) % (window.innerHeight - 200)
                } while (++nTries < 100)
                left = x
                top = y
            }
            break
        case 'center':
            left = (window.innerWidth - width) / 2
            top = (window.innerHeight - height) / 2
            break
        default:
            try {
                const nums = positionString.split('/').map(Number)
                if (nums.length != 2)
                    throw null
                const [x, y] = nums
                if (!isFinite(x) || !isFinite(y))
                    throw null
                left = x >= 0 ? x : window.innerWidth - width + x
                top = y >= 0 ? y : window.innerHeight - height + y
            }
            catch (e) {
                throw new Error(`invalid position string: ${positionString}`)
            }
    }
    el.style.left = `${left}px`
    el.style.top = `${top}px`
}


function distance2(x1: number, y1: number, x2: number, y2: number) {
    const dx = x1 - x2
    const dy = y1 - y2
    return dx * dx + dy * dy
}


export function fixPosition() {
    windows.forEach(w => {
        w.fixPosition()
    })
}


window.addEventListener('resize', e => fixPosition())