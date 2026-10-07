import type { JSX } from "effect-start/jsx-runtime"

/**
 * Displays a card with header, content, and footer.
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Card Title</CardTitle>
 *     <CardDescription>Card Description</CardDescription>
 *     <CardAction>Card Action</CardAction>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Card Content</p>
 *   </CardContent>
 *   <CardFooter>
 *     <p>Card Footer</p>
 *   </CardFooter>
 * </Card>
 * ```
 *
 * @example card with an image
 * ```tsx
 * <Card class="relative mx-auto w-full max-w-sm pt-0">
 *   <div class="absolute inset-0 z-30 aspect-video bg-black/35" />
 *   <img
 *     src="https://avatar.vercel.sh/shadcn1"
 *     alt="Event cover"
 *     class="relative z-20 aspect-video w-full object-cover brightness-60 grayscale dark:brightness-40"
 *   />
 *   <CardHeader>
 *     <CardAction>
 *       <Badge variant="secondary">Featured</Badge>
 *     </CardAction>
 *     <CardTitle>Design systems meetup</CardTitle>
 *     <CardDescription>
 *       A practical talk on component APIs, accessibility, and shipping faster.
 *     </CardDescription>
 *   </CardHeader>
 *   <CardFooter>
 *     <Button class="w-full">View Event</Button>
 *   </CardFooter>
 * </Card>
 * ```
 */
export function Card(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function CardHeader(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="Card_header"
      class={String.raw`@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=Card\_action]:grid-cols-[1fr_auto] [.border-b]:pb-6 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function CardTitle(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`leading-none font-semibold ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function CardDescription(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`text-sm text-muted-foreground ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function CardAction(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="Card_action"
      class={`col-start-2 row-span-2 row-start-1 self-start justify-self-end ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function CardContent(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return <div data-slot="Card_content" class={`px-6 ${props.class ?? ""}`} {...rest} />
}

export function CardFooter(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="Card_footer"
      class={`flex items-center px-6 [.border-t]:pt-6 ${props.class ?? ""}`}
      {...rest}
    />
  )
}

/**
 * A text input component for forms and user data entry with built-in styling
 * and accessibility features.
 *
 * @example
 * ```tsx
 * <Input />
 * ```
 *
 * @example input with a label and description
 * ```tsx
 * <Field>
 *   <FieldLabel for="input-field-username">Username</FieldLabel>
 *   <Input id="input-field-username" type="text" placeholder="Enter your username" />
 *   <FieldDescription>Choose a unique username for your account.</FieldDescription>
 * </Field>
 * ```
 *
 * @example invalid input
 * ```tsx
 * <Field data-invalid>
 *   <FieldLabel for="input-invalid">Invalid Input</FieldLabel>
 *   <Input id="input-invalid" placeholder="Error" aria-invalid />
 *   <FieldDescription>This field contains validation errors.</FieldDescription>
 * </Field>
 * ```
 *
 * @example input with a button group
 * ```tsx
 * <Field>
 *   <FieldLabel for="input-button-group">Search</FieldLabel>
 *   <ButtonGroup>
 *     <Input id="input-button-group" placeholder="Type to search..." />
 *     <Button variant="outline">Search</Button>
 *   </ButtonGroup>
 * </Field>
 * ```
 */
export function Input(props: JSX.IntrinsicElements["input"]) {
  const rest = omit(props, ["class"])
  return (
    <input
      class={`h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

/**
 * Displays a form textarea or a component that looks like a textarea.
 *
 * @example
 * ```tsx
 * <Textarea />
 * ```
 *
 * @example textarea with a label and description
 * ```tsx
 * <Field>
 *   <FieldLabel for="textarea-message">Message</FieldLabel>
 *   <FieldDescription>Enter your message below.</FieldDescription>
 *   <Textarea id="textarea-message" placeholder="Type your message here." />
 * </Field>
 * ```
 */
export function Textarea(props: JSX.IntrinsicElements["textarea"]) {
  const rest = omit(props, ["class"])
  return (
    <textarea
      class={`flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

/**
 * Renders an accessible label associated with controls. For form fields,
 * prefer the `Field` component which includes built-in label, description,
 * and error handling.
 *
 * @example
 * ```tsx
 * <Label for="email">Your email address</Label>
 * ```
 *
 * @example label paired with a checkbox
 * ```tsx
 * <div class="flex gap-2">
 *   <Checkbox id="terms" />
 *   <Label for="terms">Accept terms and conditions</Label>
 * </div>
 * ```
 */
export function Label(props: JSX.IntrinsicElements["label"]) {
  const rest = omit(props, ["class"])
  return (
    <label
      class={`flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

/**
 * Displays a badge or a component that looks like a badge.
 *
 * @example
 * ```tsx
 * <Badge variant="default | outline | secondary | destructive">Badge</Badge>
 * ```
 *
 * @example badge with an icon
 * Use `data-icon="inline-start"` or `data-icon="inline-end"` on the icon for
 * proper spacing.
 * ```tsx
 * <Badge variant="secondary">
 *   <BadgeCheck data-icon="inline-start" />
 *   Verified
 * </Badge>
 * ```
 */
export function Badge(
  props: JSX.IntrinsicElements["span"] & {
    variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"
  },
) {
  const variant = props.variant
  const rest = omit(props, ["class", "variant"])
  const v = variant ?? "default"
  const base =
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3"
  const variants = {
    default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
    destructive: "bg-destructive text-white focus-visible:ring-destructive/20 [a&]:hover:bg-destructive/90",
    outline: "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
    ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
    link: "text-primary underline-offset-4 [a&]:hover:underline",
  }
  return (
    <span
      data-slot="Badge"
      data-variant={v}
      class={`${base} ${variants[v]} ${props.class ?? ""}`}
      {...rest}
    />
  )
}

/**
 * An image element with a fallback for representing the user.
 *
 * AvatarGroup
 * ├── Avatar
 * └── AvatarGroupCount
 *
 * @example
 * ```tsx
 * <Avatar>
 *   <AvatarImage src="https://github.com/shadcn.png" />
 *   <AvatarFallback>CN</AvatarFallback>
 * </Avatar>
 * ```
 *
 * @example overlapping avatar group
 * ```tsx
 * <AvatarGroup>
 *   <Avatar>
 *     <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
 *     <AvatarFallback>CN</AvatarFallback>
 *   </Avatar>
 *   <Avatar>
 *     <AvatarImage src="https://github.com/maxleiter.png" alt="@maxleiter" />
 *     <AvatarFallback>LR</AvatarFallback>
 *   </Avatar>
 *   <Avatar>
 *     <AvatarImage src="https://github.com/evilrabbit.png" alt="@evilrabbit" />
 *     <AvatarFallback>ER</AvatarFallback>
 *   </Avatar>
 * </AvatarGroup>
 * ```
 */
export function Avatar(props: JSX.IntrinsicElements["span"] & { size?: "default" | "sm" | "lg" }) {
  const size = props.size
  const rest = omit(props, ["class", "size"])
  const s = size ?? "default"
  return (
    <span
      data-slot="Avatar"
      data-size={s}
      class={`group/avatar relative flex size-8 shrink-0 rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function AvatarImage(props: JSX.IntrinsicElements["img"]) {
  const rest = omit(props, ["class"])
  return (
    <img
      class={`aspect-square size-full shrink-0 rounded-full object-cover ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function AvatarFallback(props: JSX.IntrinsicElements["span"]) {
  const rest = omit(props, ["class"])
  return (
    <span
      class={`flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground [[data-slot=Avatar]:has(img)_&]:hidden group-data-[size=sm]/avatar:text-xs ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function AvatarBadge(props: JSX.IntrinsicElements["span"]) {
  const rest = omit(props, ["class"])
  return (
    <span
      data-slot="Avatar_badge"
      class={`absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2 group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function AvatarGroup(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`group/avatar-group flex -space-x-2 *:data-[slot=Avatar]:ring-2 *:data-[slot=Avatar]:ring-background ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function AvatarGroupCount(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

/**
 * Displays a callout for user attention.
 *
 * @example
 * ```tsx
 * <Alert>
 *   <InfoIcon />
 *   <AlertTitle>Heads up!</AlertTitle>
 *   <AlertDescription>
 *     You can add components and dependencies to your app using the cli.
 *   </AlertDescription>
 * </Alert>
 * ```
 *
 * @example destructive alert
 * ```tsx
 * <Alert variant="destructive" class="max-w-md">
 *   <AlertCircleIcon />
 *   <AlertTitle>Payment failed</AlertTitle>
 *   <AlertDescription>
 *     Your payment could not be processed. Please check your payment method
 *     and try again.
 *   </AlertDescription>
 * </Alert>
 * ```
 */
export function Alert(
  props: JSX.IntrinsicElements["div"] & { variant?: "default" | "destructive" },
) {
  const variant = props.variant
  const rest = omit(props, ["class", "variant"])
  const v = variant ?? "default"
  const base =
    "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current"
  const variants = {
    default: "bg-card text-card-foreground",
    destructive: String.raw`bg-card text-destructive *:data-[slot=Alert\_description]:text-destructive/90 [&>svg]:text-current`,
  }
  return (
    <div
      role="alert"
      class={`${base} ${variants[v]} ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function AlertTitle(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function AlertDescription(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="Alert_description"
      class={`col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

/**
 * Used to display textual user input from keyboard.
 *
 * @example
 * ```tsx
 * <Kbd>Ctrl</Kbd>
 * ```
 *
 * @example grouped keyboard shortcuts
 * ```tsx
 * <KbdGroup>
 *   <Kbd>Ctrl + B</Kbd>
 *   <Kbd>Ctrl + K</Kbd>
 * </KbdGroup>
 * ```
 */
export function Kbd(props: JSX.IntrinsicElements["kbd"]) {
  const rest = omit(props, ["class"])
  return (
    <kbd
      class={`pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none [&_svg:not([class*='size-'])]:size-3 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function KbdGroup(props: JSX.IntrinsicElements["kbd"]) {
  const rest = omit(props, ["class"])
  return (
    <kbd
      class={`inline-flex items-center gap-1 ${props.class ?? ""}`}
      {...rest}
    />
  )
}

/**
 * Displays a hierarchy of links with separators between items. Items without
 * a URL render as text; mark the current resource with `current`.
 *
 * @example
 * ```tsx
 * <Breadcrumb items={[
 *   { label: "Home", url: "/" },
 *   { label: "Components", url: "/components" },
 *   { label: "Breadcrumb", current: true },
 * ]} />
 * ```
 */
export function Breadcrumb(
  props: Omit<JSX.IntrinsicElements["nav"], "children"> & {
    items: ReadonlyArray<{
      label: JSX.Children
      url?: string
      current?: boolean
    }>
  },
) {
  const rest = omit(props, ["items"])
  return (
    <nav aria-label="breadcrumb" {...rest}>
      <ol class="flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground">
        {props.items.map((item, index) => (
          <li class="inline-flex items-center gap-1.5">
            {index > 0 ? (
              <Svg data-slot="Breadcrumb_separator" aria-hidden="true" class="size-3.5 shrink-0">
                <path d="m9 18 6-6-6-6" />
              </Svg>
            ) : null}
            {item.url !== undefined ? (
              <a
                href={item.url}
                aria-current={item.current ? "page" : undefined}
                class={`inline-flex min-h-11 items-center transition-colors hover:text-foreground md:min-h-0 ${item.current ? "text-foreground" : ""}`}
              >
                {item.label}
              </a>
            ) : (
              <span
                aria-current={item.current ? "page" : undefined}
                class={item.current ? "text-foreground" : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"

const buttonBase =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer"

const buttonVariants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
  outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
}

const buttonSizes: Record<ButtonSize, string> = {
  default: "min-h-11 min-w-11 px-4 py-2 md:h-9 md:min-h-0 md:min-w-0 has-[>svg]:px-3",
  xs:
    "min-h-11 min-w-11 gap-1 rounded-md px-3 text-xs md:h-6 md:min-h-0 md:min-w-0 md:px-2 has-[>svg]:px-2 md:has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
  sm: "min-h-11 min-w-11 gap-1.5 rounded-md px-3 md:h-8 md:min-h-0 md:min-w-0 has-[>svg]:px-2.5",
  lg: "min-h-11 min-w-11 rounded-md px-6 md:h-10 md:min-h-0 md:min-w-0 has-[>svg]:px-4",
  icon: "size-11 md:size-9",
  "icon-xs": "size-11 rounded-md md:size-6 [&_svg:not([class*='size-'])]:size-3",
  "icon-sm": "size-11 md:size-8",
  "icon-lg": "size-11 md:size-10",
}

export function buttonClassName(opts: {
  variant?: ButtonVariant
  size?: ButtonSize
  class?: string
}) {
  const v = opts.variant ?? "default"
  const s = opts.size ?? "default"
  return `${buttonBase} ${buttonVariants[v]} ${buttonSizes[s]} ${opts.class ?? ""}`
}

/**
 * Displays a button or a component that looks like a button.
 *
 * @example
 * ```tsx
 * <Button variant="outline">Button</Button>
 * ```
 *
 * @example button with an icon
 * Use `data-icon="inline-start"` or `data-icon="inline-end"` on the icon for
 * proper spacing.
 * ```tsx
 * <Button variant="outline">
 *   <Icon name="git-branch" data-icon="inline-start" /> New Branch
 * </Button>
 * ```
 */
export function Button(
  props: JSX.IntrinsicElements["button"] & {
    variant?: ButtonVariant
    size?: ButtonSize
  },
) {
  const variant = props.variant
  const size = props.size
  const type = props.type
  const rest = omit(props, ["class", "variant", "size", "type"])
  return (
    <button
      type={type ?? "button"}
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      class={buttonClassName({ variant, size, class: props.class })}
      {...rest}
    />
  )
}

/**
 * Renders pagination links in the supplied order. Items without a URL render
 * as text; disabled items never render a link. The caller supplies page ranges,
 * ellipses, or cursor URLs.
 *
 * @example
 * ```tsx
 * <Pagination items={[
 *   { label: "Previous", url: "?page=1" },
 *   { label: 1, url: "?page=1" },
 *   { label: 2, url: "?page=2", current: true },
 *   { label: "…" },
 *   { label: 10, url: "?page=10" },
 *   { label: "Next", url: "?page=3" },
 * ]} />
 * ```
 *
 * @example cursor navigation
 * ```tsx
 * <Pagination items={[
 *   { label: "Previous", disabled: true },
 *   { label: "Next", url: "?after=cursor" },
 * ]} />
 * ```
 */
export function Pagination(
  props: Omit<JSX.IntrinsicElements["nav"], "children"> & {
    items: ReadonlyArray<{
      label: JSX.Children
      url?: string
      current?: boolean
      disabled?: boolean
    }>
  },
) {
  const rest = omit(props, ["class", "items"])
  return (
    <nav
      aria-label="Pagination"
      data-slot="Pagination"
      class={`mx-auto flex w-full justify-center ${props.class ?? ""}`}
      {...rest}
    >
      <ul class="flex flex-wrap items-center justify-center gap-1">
        {props.items.map((item) => {
          const attributes = {
            "aria-current": item.current ? "page" as const : undefined,
            "aria-disabled": item.disabled ? "true" as const : undefined,
            "data-active": item.current ? "true" : undefined,
            class: item.url !== undefined || item.current || item.disabled
              ? buttonClassName({
                variant: item.current ? "outline" : "ghost",
                class: "min-w-9 px-2.5 aria-disabled:pointer-events-none aria-disabled:opacity-50",
              })
              : "inline-flex h-9 min-w-9 items-center justify-center px-2.5 text-sm",
          }
          return (
            <li>
              {item.url !== undefined && !item.disabled
                ? (
                  <a href={item.url} {...attributes}>
                    {item.label}
                  </a>
                )
                : (
                  <span {...attributes}>
                    {item.label}
                  </span>
                )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * A responsive table component.
 *
 * @example
 * ```tsx
 * <Table>
 *   <TableCaption>A list of your recent invoices.</TableCaption>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead class="w-[100px]">Invoice</TableHead>
 *       <TableHead>Status</TableHead>
 *       <TableHead class="text-right">Amount</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell class="font-medium">INV001</TableCell>
 *       <TableCell>Paid</TableCell>
 *       <TableCell class="text-right">$250.00</TableCell>
 *     </TableRow>
 *   </TableBody>
 * </Table>
 * ```
 *
 * @example table with a footer total row
 * ```tsx
 * <Table>
 *   <TableHeader>...</TableHeader>
 *   <TableBody>...</TableBody>
 *   <TableFooter>
 *     <TableRow>
 *       <TableCell colspan={3}>Total</TableCell>
 *       <TableCell class="text-right">$2,500.00</TableCell>
 *     </TableRow>
 *   </TableFooter>
 * </Table>
 * ```
 */
export function Table(props: JSX.IntrinsicElements["table"]) {
  const rest = omit(props, ["class"])
  return (
    <div class="relative w-full overflow-x-auto">
      <table
        class={`w-full caption-bottom text-sm ${props.class ?? ""}`}
        {...rest}
      />
    </div>
  )
}

export function TableHeader(props: JSX.IntrinsicElements["thead"]) {
  const rest = omit(props, ["class"])
  return <thead class={`[&_tr]:border-b ${props.class ?? ""}`} {...rest} />
}

export function TableBody(props: JSX.IntrinsicElements["tbody"]) {
  const rest = omit(props, ["class"])
  return (
    <tbody
      class={`[&_tr:last-child]:border-0 ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function TableFooter(props: JSX.IntrinsicElements["tfoot"]) {
  const rest = omit(props, ["class"])
  return (
    <tfoot
      class={`border-t bg-muted/50 font-medium [&>tr]:last:border-b-0 ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function TableRow(props: JSX.IntrinsicElements["tr"]) {
  const rest = omit(props, ["class"])
  return (
    <tr
      class={`border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function TableHead(props: JSX.IntrinsicElements["th"]) {
  const rest = omit(props, ["class"])
  return (
    <th
      class={`h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function TableCell(props: JSX.IntrinsicElements["td"]) {
  const rest = omit(props, ["class"])
  return (
    <td
      class={`p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function TableCaption(props: JSX.IntrinsicElements["caption"]) {
  const rest = omit(props, ["class"])
  return (
    <caption
      class={`mt-4 text-sm text-muted-foreground ${props.class ?? ""}`}
      {...rest}
    />
  )
}

/**
 * Use the Empty component to display an empty state.
 *
 * @example
 * ```tsx
 * <Empty>
 *   <EmptyHeader>
 *     <EmptyMedia variant="icon">
 *       <Icon name="inbox" />
 *     </EmptyMedia>
 *     <EmptyTitle>No data</EmptyTitle>
 *     <EmptyDescription>No data found</EmptyDescription>
 *   </EmptyHeader>
 *   <EmptyContent>
 *     <Button>Add data</Button>
 *   </EmptyContent>
 * </Empty>
 * ```
 */
export function Empty(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function EmptyHeader(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex max-w-sm flex-col items-center gap-2 text-center ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function EmptyMedia(props: JSX.IntrinsicElements["div"] & { variant?: "default" | "icon" }) {
  const variant = props.variant
  const rest = omit(props, ["class", "variant"])
  const v = variant ?? "default"
  const variants = {
    default: "bg-transparent",
    icon:
      "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
  }
  return (
    <div
      data-variant={v}
      class={`mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0 ${
        variants[v]
      } ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function EmptyTitle(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="Empty_title"
      class={`text-lg font-medium tracking-tight ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function EmptyDescription(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="Empty_description"
      class={`text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function EmptyContent(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance ${props.class ?? ""}`}
      {...rest}
    />
  )
}

/**
 * A versatile component for displaying content with media, title, description,
 * and actions. Use `Item` for non-form content; use `Field` for form inputs.
 *
 * @example
 * ```tsx
 * <Item>
 *   <ItemMedia variant="icon">
 *     <Icon name="folder" />
 *   </ItemMedia>
 *   <ItemContent>
 *     <ItemTitle>Title</ItemTitle>
 *     <ItemDescription>Description</ItemDescription>
 *   </ItemContent>
 *   <ItemActions>
 *     <Button>Action</Button>
 *   </ItemActions>
 * </Item>
 * ```
 */
export function Item(
  props: JSX.IntrinsicElements["div"] & {
    variant?: "default" | "outline" | "muted"
    size?: "default" | "sm"
  },
) {
  const variant = props.variant
  const size = props.size
  const rest = omit(props, ["class", "variant", "size"])
  const v = variant ?? "default"
  const s = size ?? "default"
  const base =
    "group/item flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-accent/50"
  const variants = {
    default: "bg-transparent",
    outline: "border-border",
    muted: "bg-muted/50",
  }
  const sizes = {
    default: "gap-4 p-4",
    sm: "gap-2.5 px-4 py-3",
  }
  return (
    <div
      data-slot="Item"
      data-variant={v}
      data-size={s}
      class={`${base} ${variants[v]} ${sizes[s]} ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function ItemMedia(
  props: JSX.IntrinsicElements["div"] & { variant?: "default" | "icon" | "image" },
) {
  const variant = props.variant
  const rest = omit(props, ["class", "variant"])
  const v = variant ?? "default"
  const variants = {
    default: "bg-transparent",
    icon: "size-8 rounded-sm border bg-muted [&_svg:not([class*='size-'])]:size-4",
    image: "size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
  }
  return (
    <div
      data-variant={v}
      class={String.raw`flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=Item\_description]]/item:translate-y-0.5 group-has-[[data-slot=Item\_description]]/item:self-start [&_svg]:pointer-events-none ${
        variants[v]
      } ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function ItemContent(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="Item_content"
      class={String.raw`flex flex-1 flex-col gap-1 [&+[data-slot=Item\_content]]:flex-none ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function ItemTitle(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex w-fit items-center gap-2 text-sm leading-snug font-medium ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function ItemDescription(props: JSX.IntrinsicElements["p"]) {
  const rest = omit(props, ["class"])
  return (
    <p
      data-slot="Item_description"
      class={`line-clamp-2 text-sm leading-normal font-normal text-balance text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function ItemActions(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex items-center gap-2 ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function ItemHeader(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex basis-full items-center justify-between gap-2 ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function ItemFooter(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex basis-full items-center justify-between gap-2 ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function ItemGroup(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      role="list"
      class={`group/item-group flex flex-col ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function ItemSeparator(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-orientation="horizontal"
      role="none"
      class={`my-0 h-px w-full shrink-0 bg-border ${props.class ?? ""}`}
      {...rest}
    />
  )
}

/**
 * Combine labels, controls, and help text to compose accessible form fields
 * and grouped inputs.
 *
 * @example
 * ```tsx
 * <FieldSet>
 *   <FieldLegend>Profile</FieldLegend>
 *   <FieldDescription>This appears on invoices and emails.</FieldDescription>
 *   <FieldGroup>
 *     <Field>
 *       <FieldLabel for="name">Full name</FieldLabel>
 *       <Input id="name" placeholder="Evil Rabbit" />
 *     </Field>
 *     <Field>
 *       <FieldLabel for="username">Username</FieldLabel>
 *       <Input id="username" aria-invalid />
 *       <FieldError>Choose another username.</FieldError>
 *     </Field>
 *     <Field orientation="horizontal">
 *       <Switch id="newsletter" />
 *       <FieldLabel for="newsletter">Subscribe to the newsletter</FieldLabel>
 *     </Field>
 *   </FieldGroup>
 * </FieldSet>
 * ```
 */
export function FieldSet(props: JSX.IntrinsicElements["fieldset"]) {
  const rest = omit(props, ["class"])
  return (
    <fieldset
      class={`flex flex-col gap-6 has-[>[data-slot=RadioGroup]]:gap-3 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function FieldLegend(
  props: JSX.IntrinsicElements["legend"] & { variant?: "legend" | "label" },
) {
  const variant = props.variant
  const rest = omit(props, ["class", "variant"])
  const v = variant ?? "legend"
  return (
    <legend
      data-variant={v}
      class={`mb-3 font-medium ${v === "legend" ? "text-base" : "text-sm"} ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function FieldGroup(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="Field_group"
      class={String.raw`group/field-group @container/field-group flex w-full flex-col gap-7 [&>[data-slot=Field\_group]]:gap-4 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function Field(
  props: JSX.IntrinsicElements["div"] & {
    orientation?: "vertical" | "horizontal" | "responsive"
  },
) {
  const orientation = props.orientation
  const rest = omit(props, ["class", "orientation"])
  const o = orientation ?? "vertical"
  const variants = {
    vertical: "flex-col [&>*]:w-full [&>.sr-only]:w-auto",
    horizontal:
      String.raw`flex-row items-center [&>[data-slot=Field\_label]]:flex-auto has-[>[data-slot=Field\_content]]:items-start has-[>[data-slot=Field\_content]]:[&>[role=checkbox],[role=radio]]:mt-px`,
    responsive:
      String.raw`flex-col @md/field-group:flex-row @md/field-group:items-center [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto @md/field-group:[&>[data-slot=Field\_label]]:flex-auto @md/field-group:has-[>[data-slot=Field\_content]]:items-start @md/field-group:has-[>[data-slot=Field\_content]]:[&>[role=checkbox],[role=radio]]:mt-px`,
  }
  return (
    <div
      role="group"
      data-slot="Field"
      data-orientation={o}
      class={`group/field flex w-full gap-3 data-[invalid=true]:text-destructive ${variants[o]} ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function FieldContent(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="Field_content"
      class={`group/field-content flex flex-1 flex-col gap-1.5 leading-snug ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function FieldLabel(props: JSX.IntrinsicElements["label"]) {
  const rest = omit(props, ["class"])
  return (
    <label
      data-slot="Field_label"
      class={`flex items-center gap-2 text-sm leading-none font-medium select-none group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-[>[data-slot=Field]]:w-full has-[>[data-slot=Field]]:flex-col has-[>[data-slot=Field]]:rounded-md has-[>[data-slot=Field]]:border [&>*]:data-[slot=Field]:p-4 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function FieldTitle(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="Field_label"
      class={`flex w-fit items-center gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function FieldDescription(props: JSX.IntrinsicElements["p"]) {
  const rest = omit(props, ["class"])
  return (
    <p
      class={`text-sm leading-normal font-normal text-muted-foreground group-has-[[data-orientation=horizontal]]/field:text-balance last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function FieldSeparator(props: JSX.IntrinsicElements["div"]) {
  const children = props.children
  const rest = omit(props, ["class", "children"])
  return (
    <div
      data-content={children ? "true" : "false"}
      class={`relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2 ${props.class ?? ""}`}
      {...rest}
    >
      <div role="none" class="absolute inset-0 top-1/2 h-px w-full shrink-0 bg-border" />
      {children ?
        (
          <span
            class="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          >
            {children}
          </span>
        ) :
        null}
    </div>
  )
}

export function FieldError(props: JSX.IntrinsicElements["div"]) {
  const children = props.children
  const rest = omit(props, ["class", "children"])
  if (!children) return null
  return (
    <div
      role="alert"
      class={`text-sm font-normal text-destructive ${props.class ?? ""}`}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * A container that groups related buttons together with consistent styling.
 * Use `ButtonGroup` for action buttons; use `ToggleGroup` for state toggles.
 *
 * @example
 * ```tsx
 * <ButtonGroup>
 *   <Button>Button 1</Button>
 *   <Button>Button 2</Button>
 * </ButtonGroup>
 * ```
 *
 * @example labeled button group
 * ```tsx
 * <ButtonGroup aria-label="Button group">
 *   <Button>Button 1</Button>
 *   <Button>Button 2</Button>
 * </ButtonGroup>
 * ```
 */
export function ButtonGroup(
  props: JSX.IntrinsicElements["div"] & {
    orientation?: "horizontal" | "vertical"
  },
) {
  const orientation = props.orientation
  const rest = omit(props, ["class", "orientation"])
  const o = orientation ?? "horizontal"
  const base =
    "flex w-fit items-stretch has-[>[data-slot=ButtonGroup]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 [&>input]:flex-1"
  const variants = {
    horizontal:
      "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
    vertical:
      "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
  }
  return (
    <div
      role="group"
      data-slot="ButtonGroup"
      data-orientation={o}
      class={`${base} ${variants[o]} ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function ButtonGroupText(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex items-center gap-2 rounded-md border bg-muted px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function ButtonGroupSeparator(
  props: JSX.IntrinsicElements["div"] & {
    orientation?: "horizontal" | "vertical"
  },
) {
  const orientation = props.orientation ?? "vertical"
  const rest = omit(props, ["class", "orientation"])
  return (
    <div
      data-orientation={orientation}
      role="none"
      class={`relative m-0! shrink-0 self-stretch bg-input ${orientation === "horizontal" ? "h-px w-full" : "h-auto w-px"} ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

/**
 * An indicator that can be used to show a loading state.
 *
 * @example
 * ```tsx
 * <Spinner />
 * ```
 *
 * @example spinner inside a button
 * Place before the label with `data-icon="inline-start"` (or after with
 * `inline-end`) for proper spacing.
 * ```tsx
 * <Button disabled>
 *   <Spinner data-icon="inline-start" />
 *   Saving...
 * </Button>
 * ```
 */
export function Spinner(props: JSX.IntrinsicElements["svg"]) {
  const rest = omit(props, ["class"])
  return (
    <Svg class={`size-4 animate-spin ${props.class ?? ""}`} {...rest}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </Svg>
  )
}

/**
 * Add addons, buttons, and helper content to inputs.
 *
 * For proper focus management, `InputGroupAddon` should always be placed
 * after `InputGroupInput`/`InputGroupTextarea` in the DOM. Use the `align`
 * prop to visually position the addon.
 *
 * @example
 * ```tsx
 * <InputGroup>
 *   <InputGroupInput placeholder="Search..." />
 *   <InputGroupAddon>
 *     <Icon name="search" />
 *   </InputGroupAddon>
 * </InputGroup>
 * ```
 */
export function InputGroup(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="InputGroup"
      role="group"
      class={String.raw`group/input-group relative flex w-full items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] outline-none h-9 min-w-0 has-[>textarea]:h-auto has-[>[data-align=inline-start]]:[&>input]:pl-2 has-[>[data-align=inline-end]]:[&>input]:pr-2 has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 has-[[data-slot=InputGroup\_control]:focus-visible]:border-ring has-[[data-slot=InputGroup\_control]:focus-visible]:ring-2 has-[[data-slot=InputGroup\_control]:focus-visible]:ring-ring/40 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function InputGroupAddon(
  props: JSX.IntrinsicElements["div"] & {
    align?: "inline-start" | "inline-end" | "block-start" | "block-end"
  },
) {
  const align = props.align
  const rest = omit(props, ["class", "align"])
  const a = align ?? "inline-start"
  const aligns = {
    "inline-start": "order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
    "inline-end": "order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]",
    "block-start": "order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-3",
    "block-end": "order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-3",
  }
  return (
    <div
      role="group"
      data-align={a}
      class={`flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4 ${
        aligns[a]
      } ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function InputGroupButton(
  props: JSX.IntrinsicElements["button"] & {
    variant?: ButtonVariant
    size?: "xs" | "sm" | "icon-xs" | "icon-sm"
  },
) {
  const variant = props.variant
  const size = props.size
  const type = props.type
  const rest = omit(props, ["class", "variant", "size", "type"])
  const v = variant ?? "ghost"
  const s = size ?? "xs"
  const sizes = {
    xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
    sm: "h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5",
    "icon-xs": "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
    "icon-sm": "size-8 p-0 has-[>svg]:p-0",
  }
  return (
    <button
      type={type ?? "button"}
      data-size={s}
      data-variant={v}
      class={`${buttonBase} ${buttonVariants[v]} flex items-center gap-2 text-sm shadow-none ${sizes[s]} ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function InputGroupText(props: JSX.IntrinsicElements["span"]) {
  const rest = omit(props, ["class"])
  return (
    <span
      class={`flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function InputGroupInput(props: JSX.IntrinsicElements["input"]) {
  const rest = omit(props, ["class"])
  return (
    <input
      data-slot="InputGroup_control"
      class={`h-9 w-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 py-1 text-base shadow-none outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function InputGroupTextarea(props: JSX.IntrinsicElements["textarea"]) {
  const rest = omit(props, ["class"])
  return (
    <textarea
      data-slot="InputGroup_control"
      class={`flex field-sizing-content min-h-16 w-full flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-3 text-base shadow-none outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

/**
 * A control that allows the user to toggle between checked and not checked.
 *
 * @example
 * ```tsx
 * <Checkbox />
 * ```
 *
 * @example invalid checkbox
 * Set `aria-invalid` on the checkbox and `data-invalid` on the field wrapper
 * to show the invalid styles.
 * ```tsx
 * <Field data-invalid>
 *   <Checkbox aria-invalid />
 *   <FieldLabel>Accept terms</FieldLabel>
 * </Field>
 * ```
 */
export function Checkbox(props: JSX.IntrinsicElements["input"]) {
  const rest = omit(props, ["class", "type"])
  return (
    <input
      type="checkbox"
      class={`peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none accent-primary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

/**
 * A control that allows the user to toggle between checked and not checked.
 *
 * @example
 * ```tsx
 * <Switch />
 * ```
 *
 * @example horizontal field with label
 * ```tsx
 * <Field orientation="horizontal">
 *   <Switch id="newsletter" />
 *   <FieldLabel for="newsletter">Subscribe to the newsletter</FieldLabel>
 * </Field>
 * ```
 */
export function Switch(props: Omit<JSX.IntrinsicElements["input"], "size"> & { size?: "default" | "sm" }) {
  const size = props.size
  const rest = omit(props, ["class", "size", "type"])
  const s = size ?? "default"
  return (
    <label
      data-size={s}
      class={`inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs transition-all outline-none ${
        s === "default" ? "h-[1.15rem] w-8" : "h-3.5 w-6"
      } bg-input has-[:checked]:bg-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${
        props.class ?? ""
      }`}
    >
      <input type="checkbox" class="peer sr-only" {...rest} />
      <span
        class={`pointer-events-none block translate-x-0 rounded-full bg-background ring-0 transition-transform ${
          s === "default"
            ? "size-4 peer-checked:translate-x-[calc(100%-2px)]"
            : "size-3 peer-checked:translate-x-[calc(100%-2px)]"
        }`}
      />
    </label>
  )
}

/**
 * A set of checkable buttons — known as radio buttons — where no more than
 * one of the buttons can be checked at a time.
 *
 * @example
 * ```tsx
 * <RadioGroup defaultValue="option-one">
 *   <div class="flex items-center gap-3">
 *     <RadioGroupItem value="option-one" id="option-one" />
 *     <Label for="option-one">Option One</Label>
 *   </div>
 *   <div class="flex items-center gap-3">
 *     <RadioGroupItem value="option-two" id="option-two" />
 *     <Label for="option-two">Option Two</Label>
 *   </div>
 * </RadioGroup>
 * ```
 */
export function RadioGroup(
  props: JSX.IntrinsicElements["div"] & { name?: string },
) {
  const name = props.name
  const children = props.children
  const rest = omit(props, ["class", "name", "children"])
  return (
    <div
      role="radiogroup"
      data-slot="RadioGroup"
      data-radio-group-name={name}
      class={`grid gap-3 ${props.class ?? ""}`}
      {...rest}
    >
      {children}
      {name ?
        (
          <script>
            {() => {
              const d = window.document
              const script = d.currentScript
              const root = script && script.parentElement
              if (!root) return
              const groupName = root.getAttribute("data-radio-group-name")
              if (!groupName) return
              root.querySelectorAll("input[type=\"radio\"]").forEach(function(el: any) {
                if (!el.name) el.name = groupName
              })
            }}
          </script>
        ) :
        null}
    </div>
  )
}

export function RadioGroupItem(props: JSX.IntrinsicElements["input"]) {
  const rest = omit(props, ["class", "type"])
  return (
    <input
      type="radio"
      class={`aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none accent-primary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

/**
 * A native range input with horizontal or vertical orientation.
 *
 * @example
 * ```tsx
 * <Slider value={33} min={0} max={100} step={1} aria-label="Volume" />
 * <Slider orientation="vertical" value={50} aria-label="Level" />
 * <Slider list="stops" aria-label="Amount" />
 * <datalist id="stops"><option value="0" /><option value="50" /><option value="100" /></datalist>
 * ```
 */
export function Slider(props: JSX.IntrinsicElements["input"] & { orientation?: "horizontal" | "vertical" }) {
  const orientation = props.orientation ?? "horizontal"
  const rest = omit(props, ["class", "type", "orientation"])
  return (
    <input
      type="range"
      data-orientation={orientation}
      aria-orientation={orientation}
      class={`relative flex touch-none items-center select-none accent-primary disabled:opacity-50 ${
        orientation === "vertical" ? "h-40 w-4 [writing-mode:vertical-lr] [direction:rtl]" : "w-full"
      } ${props.class ?? ""}`}
      {...rest}
    />
  )
}

/**
 * Displays an indicator showing the completion progress of a task, typically
 * displayed as a progress bar.
 *
 * @example
 * ```tsx
 * <Progress value={33} />
 * ```
 *
 * @example labeled progress with value
 * ```tsx
 * <Progress value={56} class="w-full max-w-sm">
 *   <ProgressLabel>Upload progress</ProgressLabel>
 *   <ProgressValue />
 * </Progress>
 * ```
 */
export function Progress(props: JSX.IntrinsicElements["div"] & { value?: number }) {
  const value = props.value
  const rest = omit(props, ["class", "value"])
  const v = value ?? 0
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      class={`relative h-2 w-full overflow-hidden rounded-full bg-primary/20 ${props.class ?? ""}`}
      {...rest}
    >
      <div
        data-slot="Progress_indicator"
        class="h-full w-full flex-1 bg-primary transition-all"
        style={`transform: translateX(-${100 - v}%)`}
      />
    </div>
  )
}

/**
 * A styled native HTML select element with consistent design system integration.
 * For a fully custom-styled select, use the `Select` component instead.
 *
 * @example
 * ```tsx
 * <NativeSelect>
 *   <option value="">Select a fruit</option>
 *   <option value="apple">Apple</option>
 *   <option value="banana">Banana</option>
 * </NativeSelect>
 * ```
 *
 * @example grouped options
 * ```tsx
 * <NativeSelect>
 *   <optgroup label="Fruit">
 *     <option value="apple">Apple</option>
 *     <option value="banana">Banana</option>
 *   </optgroup>
 *   <optgroup label="Vegetable">
 *     <option value="carrot">Carrot</option>
 *   </optgroup>
 * </NativeSelect>
 * ```
 */
export function NativeSelect(
  props: Omit<JSX.IntrinsicElements["select"], "size"> & { size?: "default" | "sm" },
) {
  const size = props.size
  const rest = omit(props, ["class", "size"])
  const s = size ?? "default"
  return (
    <div
      class="group/native-select relative w-fit has-[select:disabled]:opacity-50"
    >
      <select
        data-size={s}
        class={`[&_option]:bg-[Canvas] [&_option]:text-[CanvasText] [&_optgroup]:bg-[Canvas] [&_optgroup]:text-[CanvasText] h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed ${
          s === "sm" ? "h-8 py-1" : ""
        } focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 ${
          props.class ?? ""
        }`}
        {...rest}
      />
      <Svg class="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground opacity-50 select-none">
        <path d="m6 9 6 6 6-6" />
      </Svg>
    </div>
  )
}

/**
 * A vertically stacked set of interactive headings that each reveal a
 * section of content.
 *
 * @example
 * ```tsx
 * <Accordion defaultValue={["item-1"]}>
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger>Is it accessible?</AccordionTrigger>
 *     <AccordionContent>
 *       Yes. It adheres to the WAI-ARIA design pattern.
 *     </AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 * ```
 */
export function Accordion(props: JSX.IntrinsicElements["div"]) {
  return <div {...props} />
}

export function AccordionItem(props: JSX.IntrinsicElements["details"]) {
  const rest = omit(props, ["class"])
  return (
    <details
      class={`group/accordion-item border-b last:border-b-0 ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function AccordionTrigger(props: JSX.IntrinsicElements["summary"]) {
  const children = props.children
  const rest = omit(props, ["class", "children"])
  return (
    <summary
      class={`flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none cursor-pointer hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 list-none [&::-webkit-details-marker]:hidden group-open/accordion-item:[&>svg]:rotate-180 ${
        props.class ?? ""
      }`}
      {...rest}
    >
      {children}
      <Svg class="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200">
        <path d="m6 9 6 6 6-6" />
      </Svg>
    </summary>
  )
}

export function AccordionContent(props: JSX.IntrinsicElements["div"]) {
  const children = props.children
  const rest = omit(props, ["class", "children"])
  return (
    <div class="overflow-hidden text-sm">
      <div class={`pt-0 pb-4 ${props.class ?? ""}`} {...rest}>
        {children}
      </div>
    </div>
  )
}

/**
 * Autocomplete input with a list of suggestions.
 *
 * @example
 * ```tsx
 * <Combobox items={frameworks}>
 *   <ComboboxInput placeholder="Select a framework" />
 *   <ComboboxContent>
 *     <ComboboxEmpty>No items found.</ComboboxEmpty>
 *     <ComboboxList>
 *       {(item) => (
 *         <ComboboxItem key={item} value={item}>{item}</ComboboxItem>
 *       )}
 *     </ComboboxList>
 *   </ComboboxContent>
 * </Combobox>
 * ```
 */
export function Combobox(
  props: JSX.IntrinsicElements["input"] & {
    options?: ReadonlyArray<string>
    listId?: string
  },
) {
  const options = props.options
  const listId = props.listId
  const list = props.list
  const rest = omit(props, ["class", "options", "listId", "list"])
  const id = listId ?? `combobox-list-${Math.random().toString(36).slice(2, 9)}`
  return (
    <>
      <Input list={list ?? id} class={props.class} {...rest} />
      {options ?
        (
          <datalist id={id}>
            {options.map((opt) => <option value={opt} />)}
          </datalist>
        ) :
        null}
    </>
  )
}

/**
 * Navigates server-rendered commands without filtering or fetching results.
 * Keep the root and input mounted, and give items stable, document-unique IDs.
 * Selection follows an ID across updates, falling back to the previous position.
 *
 * @example
 * ```tsx
 * <Command id="actions">
 *   <CommandInput aria-label="Search actions" />
 *   <CommandList id="action-results">
 *     <CommandItem id="action-settings" href="/settings">Settings</CommandItem>
 *   </CommandList>
 * </Command>
 * ```
 */
export function Command(props: JSX.IntrinsicElements["div"] & { id: string }) {
  return (
    <div
      {...omit(props, ["class", "children"])}
      data-slot="Command"
      class={`flex w-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground ${props.class ?? ""}`}
    >
      {props.children}
      <script>
        {() => {
          const root = document.currentScript?.parentElement
          if (!root || root.dataset.effectStartCommand) return
          root.dataset.effectStartCommand = "true"

          let activeId: string | undefined
          let activeIndex = 0
          const owned = (selector: string) =>
            Array
              .from(root.querySelectorAll<HTMLElement>(selector))
              .filter((element) => element.closest("[data-slot=Command]") === root)
          const attribute = (element: Element, name: string, value: string | undefined) => {
            if (value === undefined) {
              if (element.hasAttribute(name)) element.removeAttribute(name)
            } else if (element.getAttribute(name) !== value) element.setAttribute(name, value)
          }
          const reconcile = (next?: HTMLElement, scroll = false) => {
            const input = owned("[data-slot=Command_input]")[0]
            const list = owned("[data-slot=Command_list]")[0]
            const items = owned("[data-slot=Command_item]")
            const available = items.filter((item) => {
              const unavailable = item.closest("[hidden], [inert], [aria-disabled=true]")
              return list?.contains(item) &&
                item.id &&
                !item.matches(":disabled") &&
                (!unavailable || !root.contains(unavailable))
            })
            const active = (next && available.includes(next) ? next : available.find((item) => item.id === activeId)) ??
              available[Math.min(activeIndex, available.length - 1)]
            activeId = active?.id
            activeIndex = active ? available.indexOf(active) : 0
            for (const item of items) attribute(item, "aria-selected", String(item === active))
            if (input) {
              attribute(input, "aria-controls", list?.id || undefined)
              attribute(input, "aria-expanded", String(!!list && !list.hidden))
              attribute(input, "aria-activedescendant", activeId)
            }
            if (scroll) active?.scrollIntoView({ block: "nearest" })
            return { input, available, active }
          }

          root.addEventListener("keydown", (event) => {
            const state = reconcile()
            if (event.target !== state.input || event.isComposing || event.keyCode === 229) return
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              const index = Math.max(
                0,
                Math.min(state.available.length - 1, activeIndex + (event.key === "ArrowDown" ? 1 : -1)),
              )
              reconcile(state.available[index], true)
            } else if (event.key === "Enter") {
              event.preventDefault()
              state.active?.click()
            }
          })
          root.addEventListener("pointermove", (event) => {
            if (event.pointerType === "touch" || (!event.movementX && !event.movementY)) return
            const item = event.target instanceof window.Element
              ? event.target.closest<HTMLElement>("[data-slot=Command_item]")
              : null
            if (item && item.closest("[data-slot=Command]") === root) reconcile(item)
          })
          root.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || event.pointerType !== "mouse") return
            const item = event.target instanceof window.Element ? event.target.closest("[data-slot=Command_item]") : null
            if (item && item.closest("[data-slot=Command]") === root) event.preventDefault()
          })
          root.addEventListener("click", (event) => {
            const item = event.target instanceof window.Element
              ? event.target.closest<HTMLElement>("[data-slot=Command_item]")
              : null
            if (!item || item.closest("[data-slot=Command]") !== root) return
            const state = reconcile()
            if (!state.available.includes(item)) {
              event.preventDefault()
              event.stopImmediatePropagation()
              return
            }
            reconcile(item)
            state.input?.focus({ preventScroll: true })
          }, true)

          const observer = new window.MutationObserver(() => reconcile())
          observer.observe(root, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: [
              "id",
              "hidden",
              "inert",
              "disabled",
              "aria-disabled",
              "aria-selected",
              "aria-activedescendant",
              "aria-controls",
              "aria-expanded",
              "data-slot",
            ],
          })
          reconcile()
        }}
      </script>
    </div>
  )
}

export function CommandInput(props: JSX.IntrinsicElements["input"] & { "aria-label": string }) {
  return (
    <div class="flex items-center gap-2 border-b px-3">
      <Icon name="search" class="size-4 shrink-0 opacity-50" />
      <input
        type="text"
        autocomplete="off"
        spellcheck={false}
        {...omit(props, ["class"])}
        data-slot="Command_input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="true"
        class={`h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 ${
          props.class ?? ""
        }`}
      />
    </div>
  )
}

export function CommandList(props: JSX.IntrinsicElements["div"] & { id: string }) {
  return (
    <div
      aria-label="Commands"
      {...omit(props, ["class"])}
      data-slot="Command_list"
      role="listbox"
      class={`max-h-80 overflow-y-auto overflow-x-hidden py-1 ${props.class ?? ""}`}
    />
  )
}

export function CommandItem(
  props:
    | (JSX.IntrinsicElements["button"] & { href?: never; id: string })
    | (JSX.IntrinsicElements["a"] & { href: string; id: string; disabled?: boolean }),
) {
  const attributes = {
    ...omit(props, ["class", "disabled"]),
    "data-slot": "Command_item",
    role: "option",
    tabindex: -1,
    "aria-selected": "false" as const,
    "aria-disabled": props.disabled ? "true" as const : props["aria-disabled"],
    class:
      `relative flex min-h-10 w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 ${
        props.class ?? ""
      }`,
  }
  return props.href !== undefined
    ? <a {...attributes as JSX.IntrinsicElements["a"]} />
    : <button type="button" {...attributes as JSX.IntrinsicElements["button"]} disabled={props.disabled} />
}

/**
 * A modal dialog overlaying the page, rendering content underneath inert.
 *
 * @example
 * ```tsx
 * <DialogTrigger for="confirm-delete">Open</DialogTrigger>
 * <Dialog id="confirm-delete">
 *   <DialogHeader>
 *     <DialogTitle>Are you absolutely sure?</DialogTitle>
 *     <DialogDescription>
 *       This action cannot be undone. This will permanently delete your
 *       account and remove your data from our servers.
 *     </DialogDescription>
 *   </DialogHeader>
 *   <DialogClose />
 * </Dialog>
 * ```
 */
export function Dialog(props: JSX.IntrinsicElements["dialog"] & { id: string }) {
  return (
    <dialog
      id={props.id}
      {...omit(props, ["id", "children", "class"])}
      closedby="any"
      onclick="if (event.target === this) this.close()"
      class="fixed inset-0 z-50 m-0 max-h-none max-w-none w-full h-full bg-transparent p-4 open:grid place-items-center"
    >
      <div
        class={`relative grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-lg border border-border bg-background text-foreground p-6 shadow-lg outline-none sm:max-w-lg ${
          props.class ?? ""
        }`}
      >
        {props.children}
      </div>
    </dialog>
  )
}

export function DialogTrigger(
  props: JSX.IntrinsicElements["button"] & {
    for: string
    variant?: ButtonVariant
    size?: ButtonSize
  },
) {
  const forId = props.for
  const onclick = props.onclick
  const type = props.type
  const variant = props.variant
  const size = props.size
  const children = props.children
  const rest = omit(props, ["class", "for", "onclick", "type", "variant", "size", "children"])
  const onClick = onclick ??
    "if (!('commandForElement' in this)) document.getElementById(this.getAttribute('commandfor')).showModal()"
  return (
    <button
      type={type ?? "button"}
      commandfor={forId}
      command="show-modal"
      class={buttonClassName({ variant, size, class: props.class })}
      onclick={onClick}
      {...rest}
    >
      {children}
    </button>
  )
}

export function DialogClose(props: JSX.IntrinsicElements["button"] & { for?: string }) {
  const forId = props.for
  const onclick = props.onclick
  const type = props.type
  const children = Array.isArray(props.children) && props.children.length === 0 ? undefined : props.children
  const rest = omit(props, ["class", "for", "onclick", "type", "children"])
  const onClick = onclick ??
    (forId
      ? "if (!('commandForElement' in this)) document.getElementById(this.getAttribute('commandfor')).close()"
      : "this.closest('dialog').close()")
  return (
    <button
      type={type ?? "button"}
      data-slot="Dialog_close"
      commandfor={forId}
      command={forId ? "close" : undefined}
      class={`absolute top-4 right-4 inline-flex size-6 items-center justify-center rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer ${
        props.class ?? ""
      }`}
      onclick={onClick}
      {...rest}
    >
      {children ?? (
        <>
          <Svg>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </Svg>
          <span class="sr-only">
            Close
          </span>
        </>
      )}
    </button>
  )
}

export function DialogHeader(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex flex-col gap-2 text-center sm:text-left ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function DialogFooter(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex flex-col-reverse gap-2 sm:flex-row sm:justify-end ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function DialogTitle(props: JSX.IntrinsicElements["h2"]) {
  const rest = omit(props, ["class"])
  return (
    <h2
      class={`text-lg leading-none font-semibold ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function DialogDescription(props: JSX.IntrinsicElements["p"]) {
  const rest = omit(props, ["class"])
  return (
    <p
      class={`text-sm text-muted-foreground ${props.class ?? ""}`}
      {...rest}
    />
  )
}

/**
 * A modal dialog that interrupts the user with important content and expects
 * a response.
 *
 * @example
 * ```tsx
 * <DialogTrigger for="confirm" variant="destructive">Delete account</DialogTrigger>
 * <AlertDialog id="confirm">
 *   <AlertDialogHeader>
 *     <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
 *     <AlertDialogDescription>
 *       This action cannot be undone. This will permanently delete your
 *       account from our servers.
 *     </AlertDialogDescription>
 *   </AlertDialogHeader>
 *   <AlertDialogFooter>
 *     <Button variant="outline" onclick="this.closest('dialog').close()">Cancel</Button>
 *     <AlertDialogAction variant="destructive">Continue</AlertDialogAction>
 *   </AlertDialogFooter>
 * </AlertDialog>
 * ```
 */
export function AlertDialog(
  props: JSX.IntrinsicElements["dialog"] & {
    id: string
    children?: JSX.Children
    class?: string
    size?: "default" | "sm"
  },
) {
  const s = props.size ?? "default"
  return (
    <dialog
      id={props.id}
      role="alertdialog"
      {...omit(props, ["id", "children", "class", "size"])}
      data-size={s}
      class={`group/alert-dialog-content fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[calc(100%-2rem)] gap-4 rounded-lg border bg-background p-6 shadow-lg outline-none open:grid m-0 data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-lg ${
        props.class ?? ""
      }`}
    >
      {props.children}
    </dialog>
  )
}

// AlertDialog uses DialogTrigger and DialogClose directly.

export function AlertDialogAction(
  props: JSX.IntrinsicElements["button"] & {
    for?: string
    variant?: ButtonVariant
    size?: ButtonSize
  },
) {
  const forId = props.for
  const onclick = props.onclick
  const type = props.type
  const variant = props.variant
  const size = props.size
  const children = props.children
  const rest = omit(props, ["class", "for", "onclick", "type", "variant", "size", "children"])
  const onClick = onclick ??
    (forId
      ? "if (!('commandForElement' in this)) document.getElementById(this.getAttribute('commandfor')).close()"
      : "this.closest('dialog').close()")
  return (
    <button
      type={type ?? "button"}
      commandfor={forId}
      command={forId ? "close" : undefined}
      class={buttonClassName({ variant, size, class: props.class })}
      onclick={onClick}
      {...rest}
    >
      {children}
    </button>
  )
}

export function AlertDialogHeader(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={String.raw`grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=AlertDialog\_media]:grid-rows-[auto_auto_1fr] has-data-[slot=AlertDialog\_media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function AlertDialogFooter(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function AlertDialogTitle(props: JSX.IntrinsicElements["h2"]) {
  const rest = omit(props, ["class"])
  return (
    <h2
      class={`text-lg font-semibold ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function AlertDialogDescription(props: JSX.IntrinsicElements["p"]) {
  const rest = omit(props, ["class"])
  return (
    <p
      class={`text-sm text-muted-foreground ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function AlertDialogMedia(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      data-slot="AlertDialog_media"
      class={`mb-2 inline-flex size-16 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8 ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

/**
 * A modal panel that slides in from one edge of the screen.
 *
 * @example
 * ```tsx
 * <DialogTrigger for="nav" variant="outline">Open</DialogTrigger>
 * <Sheet id="nav" side="right">
 *   <SheetHeader>
 *     <SheetTitle>Are you absolutely sure?</SheetTitle>
 *     <SheetDescription>This action cannot be undone.</SheetDescription>
 *   </SheetHeader>
 *   <SheetFooter>
 *     <Button variant="outline" onclick="this.closest('dialog').close()">Close</Button>
 *   </SheetFooter>
 * </Sheet>
 * ```
 */
export function Sheet(
  props: JSX.IntrinsicElements["dialog"] & {
    id: string
    side?: "top" | "right" | "bottom" | "left"
    children?: JSX.Children
    class?: string
  },
) {
  const side = props.side ?? "right"
  const borders = {
    right: "border-l",
    left: "border-r",
    top: "border-b",
    bottom: "border-t",
  }
  return (
    <dialog
      id={props.id}
      data-slot="Sheet"
      {...omit(props, ["id", "children", "class", "side"])}
      data-side={side}
      closedby="any"
      class={`z-50 open:flex flex-col gap-4 bg-background shadow-lg outline-none p-0 ${borders[side]} ${
        props.class ?? ""
      }`}
    >
      {props.children}
      <DialogClose for={props.id} />
      <script>
        {() => {
          const sheet = document.currentScript?.parentElement as HTMLDialogElement | null
          if (!sheet) return
          let outside = false
          const isOutside = (event: MouseEvent) => {
            const bounds = sheet.getBoundingClientRect()
            return event.target === sheet && (event.clientX < bounds.left || event
                  .clientX > bounds.right || event
                  .clientY < bounds.top || event
                  .clientY > bounds.bottom)
          }
          sheet.addEventListener("pointerdown", (event) => {
            outside = event.button === 0 && !event.ctrlKey && !event.defaultPrevented && isOutside(event)
          })
          sheet.addEventListener("pointercancel", () => {
            outside = false
          })
          sheet.addEventListener("click", (event) => {
            const dismiss = outside && !event.defaultPrevented && isOutside(event)
            outside = false
            if (dismiss) sheet.close()
          })
          sheet.addEventListener("close", () => {
            outside = false
          })
        }}
      </script>
    </dialog>
  )
}

export function SheetHeader(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`flex flex-col gap-1.5 p-4 pr-12 ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function SheetFooter(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      class={`mt-auto flex flex-col gap-2 p-4 ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function SheetTitle(props: JSX.IntrinsicElements["h2"]) {
  const rest = omit(props, ["class"])
  return (
    <h2
      class={`font-semibold text-foreground ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function SheetDescription(props: JSX.IntrinsicElements["p"]) {
  const rest = omit(props, ["class"])
  return (
    <p
      class={`text-sm text-muted-foreground ${props.class ?? ""}`}
      {...rest}
    />
  )
}

/**
 * A modal panel that slides up from the bottom of the screen with a drag
 * handle. Reuses Sheet's header/footer/title/description components.
 *
 * @example
 * ```tsx
 * <DialogTrigger for="dr-1">Open</DialogTrigger>
 * <Drawer id="dr-1">
 *   <SheetHeader>
 *     <SheetTitle>Are you absolutely sure?</SheetTitle>
 *     <SheetDescription>This action cannot be undone.</SheetDescription>
 *   </SheetHeader>
 *   <SheetFooter>
 *     <Button>Submit</Button>
 *     <Button variant="outline" onclick="this.closest('dialog').close()">Cancel</Button>
 *   </SheetFooter>
 * </Drawer>
 * ```
 */
export function Drawer(props: JSX.IntrinsicElements["dialog"] & { id: string }) {
  return (
    <dialog
      id={props.id}
      data-slot="Drawer"
      {...omit(props, ["id", "children", "class"])}
      closedby="any"
      class={`group/drawer-content z-50 open:flex flex-col rounded-t-lg border-t bg-background outline-none p-0 ${
        props.class ?? ""
      }`}
    >
      <button
        type="button"
        data-slot="Drawer_handle"
        aria-label="Close drawer"
        class="mx-auto flex h-10 w-32 shrink-0 touch-none select-none items-center justify-center rounded-md outline-none cursor-grab active:cursor-grabbing"
      >
        <span class="h-2 w-[100px] rounded-full bg-muted" />
      </button>
      {props.children}
      <script>
        {() => {
          const drawer = document.currentScript?.parentElement as HTMLDialogElement | null
          const handle = drawer?.querySelector<HTMLButtonElement>("[data-slot=Drawer_handle]")
          if (!drawer || !handle) return
          let pointer: number | undefined
          let start = 0
          let distance = 0
          let dragged = false
          let transform = ""
          let priority = ""
          const reset = () => {
            pointer = undefined
            drawer.style.setProperty("transform", transform, priority)
          }
          handle.addEventListener("pointerdown", (event) => {
            if (!event.isPrimary || event.button !== 0 || pointer !== undefined) return
            event.preventDefault()
            pointer = event.pointerId
            start = event.clientY
            distance = 0
            dragged = false
            transform = drawer.style.getPropertyValue("transform")
            priority = drawer.style.getPropertyPriority("transform")
            handle.setPointerCapture(event.pointerId)
          })
          handle.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointer) return
            distance = Math.max(0, event.clientY - start)
            dragged ||= Math.abs(event.clientY - start) > 4
            drawer.style.transform = `translateY(${distance}px)`
          })
          handle.addEventListener("pointerup", (event) => {
            if (event.pointerId !== pointer) return
            const dismiss = distance >= 80
            reset()
            handle.releasePointerCapture(event.pointerId)
            if (dismiss) drawer.close()
          })
          handle.addEventListener("pointercancel", (event) => {
            if (event.pointerId === pointer) reset()
          })
          handle.addEventListener("lostpointercapture", () => {
            if (pointer !== undefined) reset()
          })
          handle.addEventListener("click", (event) => {
            if (dragged && event.detail !== 0) event.preventDefault()
            else drawer.close()
          })
          drawer.addEventListener("close", () => {
            if (pointer !== undefined) reset()
          })
        }}
      </script>
    </dialog>
  )
}

type PopoverSide = "top" | "right" | "bottom" | "left"
type PopoverAlign = "start" | "center" | "end"

const popoverSideArea: Record<PopoverSide, Record<PopoverAlign, string>> = {
  bottom: { start: "bottom span-right", center: "bottom", end: "bottom span-left" },
  top: { start: "top span-right", center: "top", end: "top span-left" },
  right: { start: "right span-bottom", center: "right", end: "right span-top" },
  left: { start: "left span-bottom", center: "left", end: "left span-top" },
}

const popoverGap: Record<PopoverSide, string> = {
  top: "margin-bottom: 4px",
  right: "margin-left: 4px",
  bottom: "margin-top: 4px",
  left: "margin-right: 4px",
}

/**
 * Displays rich content in a portal, anchored to a trigger button.
 *
 * The trigger must declare `anchor-name: --<id>` (matching the Popover's `id`)
 * either via `<PopoverTrigger for="<id>">` or by passing `style="anchor-name: --<id>"`
 * directly on a `<Button popovertarget="<id>">`.
 *
 * @example
 * ```tsx
 * <PopoverTrigger for="pop">Open</PopoverTrigger>
 * <Popover id="pop">
 *   <div class="flex flex-col gap-1 text-sm">
 *     <h3 class="font-medium">Title</h3>
 *     <p class="text-muted-foreground">Description.</p>
 *   </div>
 * </Popover>
 * ```
 */
export function PopoverTrigger(
  props: JSX.IntrinsicElements["button"] & {
    for: string
    variant?: ButtonVariant
    size?: ButtonSize
  },
) {
  const forId = props.for
  const type = props.type
  const variant = props.variant
  const size = props.size
  const style = props.style
  const children = props.children
  const rest = omit(props, ["class", "for", "type", "variant", "size", "style", "children"])
  const anchorStyle = `anchor-name: --${forId};`
  return (
    <button
      type={type ?? "button"}
      popovertarget={forId}
      class={buttonClassName({ variant, size, class: props.class })}
      style={style ? `${anchorStyle} ${style}` : anchorStyle}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Popover(props: {
  id: string
  side?: PopoverSide
  align?: PopoverAlign
  children?: JSX.Children
  class?: string
}) {
  const side = props.side ?? "bottom"
  const align = props.align ?? "center"
  return (
    <div
      id={props.id}
      popover="auto"
      class={`z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden ${
        props.class ?? ""
      }`}
      style={`position-anchor: --${props.id}; position-area: ${popoverSideArea[side][align]}; ${popoverGap[side]};`}
    >
      {props.children}
    </div>
  )
}

/**
 * Displays a menu of actions, anchored to a trigger button.
 *
 * The trigger must declare `anchor-name: --<id>` (matching the DropdownMenu's `id`)
 * either via `<PopoverTrigger for="<id>">` or by passing `style="anchor-name: --<id>"`
 * directly on a `<Button popovertarget="<id>">`.
 *
 * @example
 * ```tsx
 * <PopoverTrigger for="menu">Open</PopoverTrigger>
 * <DropdownMenu id="menu">
 *   <DropdownMenuLabel>My Account</DropdownMenuLabel>
 *   <DropdownMenuItem>Profile</DropdownMenuItem>
 *   <DropdownMenuSeparator />
 *   <DropdownMenuItem>Log out</DropdownMenuItem>
 * </DropdownMenu>
 * ```
 */
export function DropdownMenu(props: {
  id: string
  side?: PopoverSide
  align?: PopoverAlign
  labelledBy?: string
  children?: JSX.Children
  class?: string
}) {
  const side = props.side ?? "bottom"
  const align = props.align ?? "start"
  return (
    <div
      id={props.id}
      popover="auto"
      role="menu"
      aria-labelledby={props.labelledBy}
      tabindex={-1}
      class={`z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none ${
        props.class ?? ""
      }`}
      style={`position-anchor: --${props.id}; position-area: ${popoverSideArea[side][align]}; ${
        popoverGap[side]
      }; min-width: anchor-size(width);`}
    >
      {props.children}
      <script>
        {menuScript}
      </script>
    </div>
  )
}

export function DropdownMenuGroup(props: JSX.IntrinsicElements["div"]) {
  return <div role="group" {...props} />
}

export function DropdownMenuItem(
  props: JSX.IntrinsicElements["button"] & {
    inset?: boolean
    variant?: "default" | "destructive"
  },
) {
  const inset = props.inset
  const variant = props.variant
  const type = props.type
  const rest = omit(props, ["class", "inset", "variant", "type"])
  const v = variant ?? "default"
  return (
    <button
      type={type ?? "button"}
      role="menuitem"
      tabindex={-1}
      data-slot="DropdownMenu_item"
      data-inset={inset ? "true" : undefined}
      data-variant={v}
      class={`relative flex min-h-11 w-full cursor-default items-center gap-2 rounded-sm px-3 py-1.5 text-sm whitespace-nowrap outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground md:min-h-0 md:px-2 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[inset=true]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:hover:bg-destructive/10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function DropdownMenuCheckboxItem(props: JSX.IntrinsicElements["button"] & { checked?: boolean }) {
  const rest = omit(props, ["class", "checked", "type", "children"])
  return (
    <button
      type={props.type ?? "button"}
      role="menuitemcheckbox"
      tabindex={-1}
      data-slot="DropdownMenu_checkboxItem"
      data-state={props.checked ? "checked" : "unchecked"}
      aria-checked={props.checked ? "true" : "false"}
      onclick="const checked = this.getAttribute('aria-checked') !== 'true'; this.setAttribute('aria-checked', String(checked)); this.dataset.state = checked ? 'checked' : 'unchecked'"
      class={`relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 ${
        props.class ?? ""
      }`}
      {...rest}
    >
      <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center [[data-state=unchecked]_&]:invisible">
        <Svg class="size-4">
          <path d="M20 6 9 17l-5-5" />
        </Svg>
      </span>
      {props.children}
    </button>
  )
}

export function DropdownMenuRadioGroup(props: JSX.IntrinsicElements["div"]) {
  return <div data-slot="DropdownMenu_radioGroup" role="group" {...props} />
}

export function DropdownMenuRadioItem(props: JSX.IntrinsicElements["button"] & { checked?: boolean }) {
  const rest = omit(props, ["class", "checked", "type", "children"])
  return (
    <button
      type={props.type ?? "button"}
      role="menuitemradio"
      tabindex={-1}
      data-slot="DropdownMenu_radioItem"
      data-state={props.checked ? "checked" : "unchecked"}
      aria-checked={props.checked ? "true" : "false"}
      onclick="for (const item of this.closest('[data-slot=DropdownMenu_radioGroup]').querySelectorAll('[role=menuitemradio]')) { const checked = item === this; item.setAttribute('aria-checked', String(checked)); item.dataset.state = checked ? 'checked' : 'unchecked' }"
      class={`relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 ${
        props.class ?? ""
      }`}
      {...rest}
    >
      <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center [[data-state=unchecked]_&]:invisible">
        <Svg class="size-2 fill-current">
          <circle cx="12" cy="12" r="10" />
        </Svg>
      </span>
      {props.children}
    </button>
  )
}

export function DropdownMenuLabel(props: JSX.IntrinsicElements["div"] & { inset?: boolean }) {
  const inset = props.inset
  const rest = omit(props, ["class", "inset"])
  return (
    <div
      data-inset={inset ? "true" : undefined}
      class={`px-2 py-1.5 text-sm font-medium data-[inset=true]:pl-8 ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function DropdownMenuSeparator(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      role="separator"
      class={`-mx-1 my-1 h-px bg-border ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function DropdownMenuShortcut(props: JSX.IntrinsicElements["span"]) {
  const rest = omit(props, ["class"])
  return (
    <span
      class={`ml-auto text-xs tracking-widest text-muted-foreground ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function DropdownMenuSub(props: JSX.IntrinsicElements["div"]) {
  return <div {...props} />
}

export function DropdownMenuSubTrigger(
  props: JSX.IntrinsicElements["button"] & { for: string; inset?: boolean },
) {
  const forId = props.for
  const inset = props.inset
  const type = props.type
  const children = props.children
  const rest = omit(props, ["class", "for", "inset", "type", "children"])
  return (
    <button
      type={type ?? "button"}
      popovertarget={forId}
      role="menuitem"
      aria-haspopup="menu"
      aria-controls={forId}
      aria-expanded="false"
      tabindex={-1}
      data-slot="DropdownMenu_subTrigger"
      style={`anchor-name: --${forId};`}
      data-inset={inset ? "true" : undefined}
      class={`flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[inset=true]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground ${
        props.class ?? ""
      }`}
      {...rest}
    >
      {children}
      <Svg class="ml-auto size-4">
        <path d="m9 18 6-6-6-6" />
      </Svg>
    </button>
  )
}

export function DropdownMenuSubContent(props: {
  id: string
  for: string
  children?: JSX.Children
  class?: string
}) {
  return (
    <div
      id={props.id}
      popover="auto"
      role="menu"
      tabindex={-1}
      class={`z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg outline-none ${
        props.class ?? ""
      }`}
      style={`position-anchor: --${props.for}; position-area: right span-bottom; ${popoverGap.right};`}
    >
      {props.children}
      <script>
        {menuScript}
      </script>
    </div>
  )
}

/**
 * Displays a menu of actions triggered by a right click.
 *
 * @example
 * ```tsx
 * <ContextMenu>
 *   <ContextMenuTrigger>Right click here</ContextMenuTrigger>
 *   <ContextMenuContent>
 *     <ContextMenuItem>Profile</ContextMenuItem>
 *     <ContextMenuItem>Billing</ContextMenuItem>
 *     <ContextMenuItem>Team</ContextMenuItem>
 *   </ContextMenuContent>
 * </ContextMenu>
 * ```
 */
export function ContextMenu(props: { children?: JSX.Children }) {
  return (
    <>
      {props.children}
    </>
  )
}

export function ContextMenuTrigger(props: JSX.IntrinsicElements["div"] & { for: string }) {
  const forId = props.for
  const children = props.children
  const rest = omit(props, ["class", "for", "children"])
  return (
    <div data-context-menu-target={forId} class={props.class} {...rest}>
      {children}
      <script>
        {() => {
          const d = window.document
          const script = d.currentScript
          const trigger = script && script.parentElement
          if (!trigger) return
          const targetId = trigger.getAttribute("data-context-menu-target")
          if (!targetId) return
          trigger.addEventListener("contextmenu", function(e: MouseEvent) {
            const menu = d.getElementById(targetId)
            if (!menu) return
            e.preventDefault()
            const bounds = trigger.getBoundingClientRect()
            menu.style.position = "fixed"
            menu.style.positionAnchor = "auto"
            menu.style.setProperty("position-area", "none")
            menu.style.left = (e.clientX || bounds.left) + "px"
            menu.style.top = (e.clientY || bounds.bottom) + "px"
            menu.style.margin = "0"
            const open = () =>
              setTimeout(() => {
                if (menu.isConnected) menu.showPopover()
              }, 0)
            // macOS dispatches contextmenu before release; pointerup would light-dismiss a menu opened here.
            if (e.buttons) d.addEventListener("pointerup", open, { once: true })
            else open()
          })
        }}
      </script>
    </div>
  )
}

// ContextMenu items reuse DropdownMenuItem, DropdownMenuCheckboxItem, etc.
// directly — the popover content shape is identical.

/**
 * A visually persistent menu common in desktop applications that provides
 * quick access to a consistent set of commands.
 *
 * @example
 * ```tsx
 * <Menubar>
 *   <MenubarMenu>
 *     <MenubarTrigger>File</MenubarTrigger>
 *     <MenubarContent>
 *       <MenubarItem>New Tab</MenubarItem>
 *       <MenubarItem>New Window</MenubarItem>
 *       <MenubarSeparator />
 *       <MenubarItem>Share</MenubarItem>
 *       <MenubarItem>Print</MenubarItem>
 *     </MenubarContent>
 *   </MenubarMenu>
 * </Menubar>
 * ```
 */
export function Menubar(props: JSX.IntrinsicElements["div"]) {
  const rest = omit(props, ["class"])
  return (
    <div
      role="menubar"
      class={`flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function MenubarMenu(props: JSX.IntrinsicElements["div"]) {
  return <div class="relative" {...props} />
}

export function MenubarTrigger(
  props: JSX.IntrinsicElements["button"] & { for: string },
) {
  const forId = props.for
  const type = props.type
  const children = props.children
  const rest = omit(props, ["class", "for", "type", "children"])
  return (
    <button
      type={type ?? "button"}
      id={`${forId}-trigger`}
      popovertarget={forId}
      style={`anchor-name: --${forId};`}
      class={`flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground ${
        props.class ?? ""
      }`}
      {...rest}
    >
      {children}
    </button>
  )
}

// Menubar items reuse DropdownMenuItem, DropdownMenuCheckboxItem, etc.
// directly — the popover content shape is identical.

/**
 * Rich preview shown on hover/focus of a trigger element. Trigger is resolved once
 * on mount: swapping the trigger after load won't rewire, and removing the card
 * while the trigger remains leaks listeners (no-op on hover).
 *
 * @example
 * ```tsx
 * <a id="hc1-link" href="/v">Vercel</a>
 * <HoverCard for="hc1-link" id="hc1">
 *   The React framework, by @vercel.
 * </HoverCard>
 * ```
 */
export function HoverCard(props: {
  id: string
  for: string
  side?: PopoverSide
  align?: PopoverAlign
  children?: JSX.Children
  class?: string
}) {
  const side = props.side ?? "bottom"
  const align = props.align ?? "center"
  return (
    <div
      id={props.id}
      popover="manual"
      data-trigger={props.for}
      class={`z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden ${
        props.class ?? ""
      }`}
      style={`position-area: ${popoverSideArea[side][align]}; ${popoverGap[side]};`}
    >
      {props.children}
      <script>
        {() => {
          const d = window.document
          const script = d.currentScript
          const card = script && script.parentElement
          if (!card) return
          const triggerId = card.getAttribute("data-trigger")
          if (!triggerId) return
          const trigger = d.getElementById(triggerId)
          if (!trigger) return
          // popover="manual" has no implicit invoker anchor — wire it up via named anchor.
          const anchorName = `--${triggerId}`
          trigger.style.setProperty("anchor-name", anchorName)
          card.style.setProperty("position-anchor", anchorName)
          let openTimer: any = null
          let closeTimer: any = null
          const open = function() {
            if (closeTimer) {
              clearTimeout(closeTimer)
              closeTimer = null
            }
            openTimer = setTimeout(function() {
              if (!card.isConnected) return
              if (!card.matches(":popover-open")) card.showPopover()
            }, 200)
          }
          const close = function() {
            if (openTimer) {
              clearTimeout(openTimer)
              openTimer = null
            }
            closeTimer = setTimeout(function() {
              if (!card.isConnected) return
              if (card.matches(":popover-open")) card.hidePopover()
            }, 150)
          }
          trigger.addEventListener("mouseenter", open)
          trigger.addEventListener("mouseleave", close)
          trigger.addEventListener("focus", open)
          trigger.addEventListener("blur", close)
          card.addEventListener("mouseenter", function() {
            if (closeTimer) {
              clearTimeout(closeTimer)
              closeTimer = null
            }
          })
          card.addEventListener("mouseleave", close)
        }}
      </script>
    </div>
  )
}

/**
 * A small label shown when the user hovers or focuses the trigger element.
 * Trigger is resolved once on mount: swapping the trigger after load won't rewire,
 * and removing the tooltip while the trigger remains leaks listeners (no-op on hover).
 *
 * @example
 * ```tsx
 * <Button id="t1-btn">Hover me</Button>
 * <Tooltip for="t1-btn" id="t1">Add to library</Tooltip>
 * ```
 */
export function Tooltip(props: {
  id: string
  for: string
  side?: PopoverSide
  align?: PopoverAlign
  children?: JSX.Children
  class?: string
}) {
  const side = props.side ?? "top"
  const align = props.align ?? "center"
  return (
    <div
      id={props.id}
      popover="manual"
      data-trigger={props.for}
      class={`z-50 w-fit rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background outline-none ${
        props.class ?? ""
      }`}
      style={`position-area: ${popoverSideArea[side][align]}; ${popoverGap[side]};`}
    >
      {props.children}
      <script>
        {() => {
          const d = window.document
          const script = d.currentScript
          const tip = script && script.parentElement
          if (!tip) return
          const triggerId = tip.getAttribute("data-trigger")
          if (!triggerId) return
          const trigger = d.getElementById(triggerId)
          if (!trigger) return
          const anchorName = `--${triggerId}`
          trigger.style.setProperty("anchor-name", anchorName)
          tip.style.setProperty("position-anchor", anchorName)
          let openTimer: any = null
          const open = function() {
            openTimer = setTimeout(function() {
              if (!tip.isConnected) return
              if (!tip.matches(":popover-open")) tip.showPopover()
            }, 100)
          }
          const close = function() {
            if (openTimer) {
              clearTimeout(openTimer)
              openTimer = null
            }
            if (!tip.isConnected) return
            if (tip.matches(":popover-open")) tip.hidePopover()
          }
          trigger.addEventListener("mouseenter", open)
          trigger.addEventListener("mouseleave", close)
          trigger.addEventListener("focus", open)
          trigger.addEventListener("blur", close)
          window.addEventListener("scroll", close, true)
          window.addEventListener("wheel", close, { passive: true })
          window.addEventListener("resize", close)
        }}
      </script>
    </div>
  )
}

/**
 * A set of layered sections of content — known as tab panels — that are
 * displayed one at a time.
 *
 * @example
 * ```tsx
 * <Tabs defaultValue="account" class="w-[400px]">
 *   <TabsList>
 *     <TabsTrigger value="account">Account</TabsTrigger>
 *     <TabsTrigger value="password">Password</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="account">Make changes to your account here.</TabsContent>
 *   <TabsContent value="password">Change your password here.</TabsContent>
 * </Tabs>
 * ```
 */
export function Tabs(
  props: JSX.IntrinsicElements["div"] & {
    name: string
    orientation?: "horizontal" | "vertical"
  },
) {
  const orientation = props.orientation
  const rest = omit(props, ["class", "name", "orientation"])
  const o = orientation ?? "horizontal"
  return (
    <div
      data-slot="Tabs"
      data-orientation={o}
      class={`group/tabs flex gap-2 data-[orientation=horizontal]:flex-col ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function TabsList(props: JSX.IntrinsicElements["div"] & { variant?: "default" | "line" }) {
  const variant = props.variant
  const rest = omit(props, ["class", "variant"])
  const v = variant ?? "default"
  const variants = {
    default: "bg-muted",
    line: "gap-1 bg-transparent",
  }
  return (
    <div
      data-variant={v}
      role="tablist"
      class={`group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none ${
        variants[v]
      } ${props.class ?? ""}`}
      {...rest}
    />
  )
}

export function TabsTrigger(
  props: JSX.IntrinsicElements["label"] & {
    name: string
    value: string
    checked?: boolean
  },
) {
  const name = props.name
  const value = props.value
  const checked = props.checked
  const children = props.children
  const rest = omit(props, ["class", "name", "value", "checked", "children"])
  return (
    <label
      class={`relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all cursor-pointer group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground has-[:checked]:bg-background has-[:checked]:text-foreground has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50 group-data-[variant=default]/tabs-list:has-[:checked]:shadow-sm group-data-[variant=line]/tabs-list:has-[:checked]:shadow-none has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:has-[:checked]:bg-transparent after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:has-[:checked]:after:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 ${
        props.class ?? ""
      }`}
      {...rest}
    >
      <input
        type="radio"
        class="peer sr-only"
        name={name}
        value={value}
        checked={checked}
        data-tabs-name={name}
        data-tabs-value={value}
      />
      {children}
    </label>
  )
}

export function TabsContent(props: JSX.IntrinsicElements["div"] & { name: string; value: string }) {
  const name = props.name
  const value = props.value
  const rest = omit(props, ["class", "name", "value"])
  return (
    <div
      data-slot="Tabs_content"
      data-tabs-name={name}
      data-tabs-value={value}
      hidden
      class={`flex-1 outline-none ${props.class ?? ""}`}
      {...rest}
    >
      {rest.children}
      <script>
        {() => {
          const d = window.document
          const script = d.currentScript
          const panel = script && script.parentElement
          if (!panel) return
          const groupName = panel.getAttribute("data-tabs-name")
          const groupValue = panel.getAttribute("data-tabs-value")
          if (!groupName || !groupValue) return
          const sync = function() {
            const trigger = d.querySelector<HTMLInputElement>(
              `input[type=radio][data-tabs-name="${groupName}"]:checked`,
            )
            const active = trigger ? trigger.value : null
            if (active === null) {
              panel.hidden = false
            } else {
              panel.hidden = active !== groupValue
            }
          }
          d.querySelectorAll(`input[type=radio][data-tabs-name="${groupName}"]`).forEach(function(
            el: any,
          ) {
            el.addEventListener("change", sync)
          })
          sync()
        }}
      </script>
    </div>
  )
}

type ToggleVariant = "default" | "outline"
type ToggleSize = "default" | "sm" | "lg"

const toggleBase =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none cursor-pointer hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50 has-[:checked]:bg-accent has-[:checked]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

const toggleVariants: Record<ToggleVariant, string> = {
  default: "bg-transparent",
  outline: "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
}

const toggleSizes: Record<ToggleSize, string> = {
  default: "h-9 min-w-9 px-2",
  sm: "h-8 min-w-8 px-1.5",
  lg: "h-10 min-w-10 px-2.5",
}

/**
 * A two-state button that can be either on or off.
 *
 * @example
 * ```tsx
 * <Toggle>Toggle</Toggle>
 * ```
 *
 * @example icon toggle with aria label
 * ```tsx
 * <Toggle aria-label="Toggle bold">
 *   <Icon name="bold" />
 * </Toggle>
 * ```
 */
export function Toggle(
  props: Omit<JSX.IntrinsicElements["input"], "size"> & {
    variant?: ToggleVariant
    size?: ToggleSize
    children?: JSX.Children
  },
) {
  const variant = props.variant
  const size = props.size
  const children = props.children
  const rest = omit(props, ["class", "variant", "size", "type", "children"])
  const v = variant ?? "default"
  const s = size ?? "default"
  return (
    <label
      data-slot="Toggle"
      data-variant={v}
      data-size={s}
      class={`${toggleBase} ${toggleVariants[v]} ${toggleSizes[s]} ${props.class ?? ""}`}
    >
      <input type="checkbox" class="peer sr-only" {...rest} />
      {children}
    </label>
  )
}

/**
 * A set of two-state buttons that can be toggled on or off.
 *
 * @example
 * ```tsx
 * <ToggleGroup type="single">
 *   <ToggleGroupItem value="a">A</ToggleGroupItem>
 *   <ToggleGroupItem value="b">B</ToggleGroupItem>
 *   <ToggleGroupItem value="c">C</ToggleGroupItem>
 * </ToggleGroup>
 * ```
 */
export function ToggleGroup(
  props: JSX.IntrinsicElements["div"] & {
    variant?: ToggleVariant
    size?: ToggleSize
    spacing?: number
  },
) {
  const variant = props.variant
  const size = props.size
  const spacing = props.spacing
  const style = props.style
  const rest = omit(props, ["class", "variant", "size", "spacing", "style"])
  const v = variant ?? "default"
  const s = size ?? "default"
  const sp = spacing ?? 0
  const mergedStyle = `--gap: ${sp};${style ? ` ${style}` : ""}`
  return (
    <div
      role="group"
      data-slot="ToggleGroup"
      data-variant={v}
      data-size={s}
      data-spacing={sp}
      style={mergedStyle}
      class={`group/toggle-group flex w-fit items-center gap-(--gap) rounded-md data-[spacing=0]:data-[variant=outline]:shadow-xs ${
        props.class ?? ""
      }`}
      {...rest}
    />
  )
}

export function ToggleGroupItem(
  props: Omit<JSX.IntrinsicElements["input"], "size"> & {
    variant?: ToggleVariant
    size?: ToggleSize
    children?: JSX.Children
  },
) {
  const variant = props.variant
  const size = props.size
  const type = props.type
  const children = props.children
  const rest = omit(props, ["class", "variant", "size", "type", "children"])
  const v = variant ?? "default"
  const s = size ?? "default"
  const t = type ?? "checkbox"
  return (
    <label
      data-variant={v}
      data-size={s}
      class={`${toggleBase} ${toggleVariants[v]} ${
        toggleSizes[s]
      } w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:shadow-none group-data-[spacing=0]/toggle-group:first:rounded-l-md group-data-[spacing=0]/toggle-group:last:rounded-r-md group-data-[spacing=0]/toggle-group:data-[variant=outline]:border-l-0 group-data-[spacing=0]/toggle-group:data-[variant=outline]:first:border-l ${
        props.class ?? ""
      }`}
    >
      <input type={t} class="peer sr-only" {...rest} />
      {children}
    </label>
  )
}

// No Form*. Compose forms with Field/FieldGroup/FieldLabel/FieldDescription/FieldError
// and native form validation.

// No Select*. Use NativeSelect with native option and optgroup elements.

/**
 * An opinionated toast component to display a transient message to the user.
 *
 * @example
 * ```tsx
 * <Toast title="Event has been created." />
 * ```
 *
 * @example destructive toast with description
 * ```tsx
 * <Toast
 *   variant="error"
 *   title="Something went wrong"
 *   description="Please try again."
 *   position="top-right"
 * />
 * ```
 */
export function Toast(props: {
  title?: string
  description?: string
  variant?: "default" | "success" | "info" | "warning" | "error"
  duration?: number
  position?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right"
  class?: string
  children?: JSX.Children
}) {
  const variant = props.variant ?? "default"
  const duration = props.duration ?? 4000
  const position = props.position ?? "bottom-right"
  const iconColor = {
    default: "text-foreground",
    success: "text-emerald-600",
    info: "text-sky-600",
    warning: "text-amber-600",
    error: "text-destructive",
  }[variant]
  const iconPath = {
    default: <circle cx="12" cy="12" r="10" />,
    success: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </>
    ),
    warning: (
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    error: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
      </>
    ),
  }[variant]
  return (
    <li
      data-slot="Toast"
      role="status"
      aria-live="polite"
      data-variant={variant}
      data-duration={duration}
      data-position={position}
      class={`pointer-events-auto flex w-full items-center gap-1.5 rounded-[10px] border bg-popover text-popover-foreground p-4 text-[13px] font-medium shadow-[0_4px_12px_rgba(0,0,0,0.1)] ${
        props.class ?? ""
      }`}
      style="opacity:0;transform:translateY(-100%);transition:opacity 400ms,transform 400ms;"
    >
      <Svg class={`size-4 shrink-0 mr-1 ${iconColor}`}>
        {iconPath}
      </Svg>
      <div class="flex flex-1 flex-col gap-1">
        {props.title
          ? (
            <div class="leading-[1.5]">
              {props.title}
            </div>
          )
          : null}
        {props.description ?
          (
            <div class="text-[13px] font-normal text-muted-foreground leading-[1.5]">
              {props.description}
            </div>
          ) :
          null}
        {props.children}
      </div>
      <script>
        {() => {
          const doc = window.document
          const script = doc.currentScript
          const toast = script && script.parentElement as HTMLElement | null
          if (!toast) return
          const pos = toast.getAttribute("data-position") || "bottom-right"
          const positionClasses: Record<string, string> = {
            "top-left": "top-6 left-6 items-start",
            "top-center": "top-6 left-1/2 -translate-x-1/2 items-center",
            "top-right": "top-6 right-6 items-end",
            "bottom-left": "bottom-6 left-6 items-start",
            "bottom-center": "bottom-6 left-1/2 -translate-x-1/2 items-center",
            "bottom-right": "bottom-6 right-6 items-end",
          }
          let toaster = doc.querySelector<HTMLElement>(`[data-slot=Toaster][data-position="${pos}"]`)
          if (!toaster) {
            toaster = doc.createElement("ol")
            toaster.setAttribute("data-slot", "Toaster")
            toaster.setAttribute("data-position", pos)
            toaster.style.setProperty("--toaster-width", "356px")
            toaster.className =
              "pointer-events-none fixed z-[100] flex w-(--toaster-width) max-w-[calc(100%-2rem)] flex-col gap-[14px] outline-none " +
              (positionClasses[pos] || positionClasses["bottom-right"])
            doc.body.appendChild(toaster)
          }
          const startsTop = pos.indexOf("top") === 0
          if (startsTop) toaster.appendChild(toast)
          else toaster.insertBefore(toast, toaster.firstChild)
          const enterFrom = startsTop ? "translateY(-100%)" : "translateY(100%)"
          toast.style.transform = enterFrom
          requestAnimationFrame(() => {
            toast.style.opacity = "1"
            toast.style.transform = "translateY(0)"
          })
          const dur = parseInt(toast.getAttribute("data-duration") || "4000", 10)
          if (dur > 0) {
            setTimeout(function() {
              toast.style.opacity = "0"
              toast.style.transform = enterFrom
              setTimeout(function() {
                toast.remove()
                if (toaster && toaster.children.length === 0) toaster.remove()
              }, 400)
            }, dur)
          }
        }}
      </script>
    </li>
  )
}

/**
 * Accessible resizable panel groups and layouts with keyboard support.
 *
 * @example
 * ```tsx
 * <ResizablePanelGroup orientation="horizontal">
 *   <ResizablePanel>One</ResizablePanel>
 *   <ResizableHandle />
 *   <ResizablePanel>Two</ResizablePanel>
 * </ResizablePanelGroup>
 * ```
 */
export function ResizablePanelGroup(
  props: JSX.IntrinsicElements["div"] & { direction?: "horizontal" | "vertical" },
) {
  const direction = props.direction
  const children = props.children
  const rest = omit(props, ["class", "direction", "children"])
  const d = direction ?? "horizontal"
  return (
    <div
      data-direction={d}
      aria-orientation={d}
      class={`flex h-full w-full ${d === "vertical" ? "flex-col" : ""} ${props.class ?? ""}`}
      {...rest}
    >
      {children}
      <script>
        {() => {
          const doc = window.document
          const script = doc.currentScript
          const group = script && script.parentElement
          if (!group) return
          const isVertical = group.getAttribute("data-direction") === "vertical"
          const sizeProp = isVertical ? "offsetHeight" : "offsetWidth"
          const clientProp = isVertical ? "clientY" : "clientX"
          let dragging: any = null
          group.addEventListener("pointerdown", function(e: any) {
            const handle = e.target.closest("[data-slot=Resizable_handle]")
            if (!handle || !group.contains(handle)) return
            const prev = handle.previousElementSibling
            const next = handle.nextElementSibling
            if (!prev || !next) return
            e.preventDefault()
            handle.setPointerCapture(e.pointerId)
            const total = prev[sizeProp] + next[sizeProp]
            const start = e[clientProp]
            const startPrev = prev[sizeProp]
            const prevMin = parseFloat(prev.getAttribute("data-min-size") || "0")
            const prevMax = parseFloat(prev.getAttribute("data-max-size") || "100")
            const nextMin = parseFloat(next.getAttribute("data-min-size") || "0")
            const nextMax = parseFloat(next.getAttribute("data-max-size") || "100")
            dragging = {
              handle,
              prev,
              next,
              total,
              start,
              startPrev,
              prevMin,
              prevMax,
              nextMin,
              nextMax,
            }
          })
          group.addEventListener("pointermove", function(e: any) {
            if (!dragging) return
            const delta = e[clientProp] - dragging.start
            const newPrevPx = Math.max(0, Math.min(dragging.total, dragging.startPrev + delta))
            let prevPct = (newPrevPx / dragging.total) * 100
            let nextPct = 100 - prevPct
            if (prevPct < dragging.prevMin) {
              prevPct = dragging.prevMin
              nextPct = 100 - prevPct
            }
            if (prevPct > dragging.prevMax) {
              prevPct = dragging.prevMax
              nextPct = 100 - prevPct
            }
            if (nextPct < dragging.nextMin) {
              nextPct = dragging.nextMin
              prevPct = 100 - nextPct
            }
            if (nextPct > dragging.nextMax) {
              nextPct = dragging.nextMax
              prevPct = 100 - nextPct
            }
            dragging.prev.style.flex = prevPct + " 1 0"
            dragging.next.style.flex = nextPct + " 1 0"
          })
          const stop = function(e: any) {
            if (!dragging) return
            try {
              dragging.handle.releasePointerCapture(e.pointerId)
            } catch {}
            dragging = null
          }
          group.addEventListener("pointerup", stop)
          group.addEventListener("pointercancel", stop)
          group.addEventListener("keydown", function(e: any) {
            const handle = e.target.closest("[data-slot=Resizable_handle]")
            if (!handle || !group.contains(handle)) return
            const prev = handle.previousElementSibling
            const next = handle.nextElementSibling
            if (!prev || !next) return
            const decrease = isVertical ? "ArrowUp" : "ArrowLeft"
            const increase = isVertical ? "ArrowDown" : "ArrowRight"
            if (e.key !== decrease && e.key !== increase) return
            e.preventDefault()
            const dir = e.key === increase ? 1 : -1
            const total = prev[sizeProp] + next[sizeProp]
            const stepPct = 5
            const curPct = (prev[sizeProp] / total) * 100
            const prevMin = parseFloat(prev.getAttribute("data-min-size") || "0")
            const prevMax = parseFloat(prev.getAttribute("data-max-size") || "100")
            const nextMin = parseFloat(next.getAttribute("data-min-size") || "0")
            const nextMax = parseFloat(next.getAttribute("data-max-size") || "100")
            let prevPct = Math.max(0, Math.min(100, curPct + dir * stepPct))
            let nextPct = 100 - prevPct
            if (prevPct < prevMin) {
              prevPct = prevMin
              nextPct = 100 - prevPct
            }
            if (prevPct > prevMax) {
              prevPct = prevMax
              nextPct = 100 - prevPct
            }
            if (nextPct < nextMin) {
              nextPct = nextMin
              prevPct = 100 - nextPct
            }
            if (nextPct > nextMax) {
              nextPct = nextMax
              prevPct = 100 - nextPct
            }
            prev.style.flex = prevPct + " 1 0"
            next.style.flex = nextPct + " 1 0"
          })
        }}
      </script>
    </div>
  )
}

export function ResizablePanel(
  props: JSX.IntrinsicElements["div"] & {
    defaultSize?: number
    minSize?: number
    maxSize?: number
  },
) {
  const defaultSize = props.defaultSize
  const minSize = props.minSize
  const maxSize = props.maxSize
  const style = props.style
  const rest = omit(props, ["class", "defaultSize", "minSize", "maxSize", "style"])
  const grow = defaultSize ?? 1
  const flexStyle = `flex: ${grow} 1 0;${style ? ` ${style}` : ""}`
  return (
    <div
      data-slot="Resizable_panel"
      data-min-size={minSize ?? 0}
      data-max-size={maxSize ?? 100}
      class={`overflow-hidden ${props.class ?? ""}`}
      style={flexStyle}
      {...rest}
    />
  )
}

export function ResizableHandle(props: JSX.IntrinsicElements["div"] & { withHandle?: boolean }) {
  const withHandle = props.withHandle
  const children = props.children
  const rest = omit(props, ["class", "withHandle", "children"])
  return (
    <div
      data-slot="Resizable_handle"
      role="separator"
      tabindex={0}
      class={`relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden cursor-col-resize touch-none [[data-direction=vertical]_&]:h-px [[data-direction=vertical]_&]:w-full [[data-direction=vertical]_&]:cursor-row-resize [[data-direction=vertical]_&]:after:left-0 [[data-direction=vertical]_&]:after:h-1 [[data-direction=vertical]_&]:after:w-full [[data-direction=vertical]_&]:after:translate-x-0 [[data-direction=vertical]_&]:after:-translate-y-1/2 [[data-direction=vertical]_&>div]:rotate-90 ${
        props.class ?? ""
      }`}
      {...rest}
    >
      {withHandle ?
        (
          <div class="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
            <Svg class="size-2.5">
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </Svg>
          </div>
        ) :
        children}
    </div>
  )
}

/**
 * A carousel with scroll snapping, touch scrolling, and keyboard navigation.
 * Optional leftButton and rightButton props replace the contents of its buttons.
 * Leave either undefined for the default arrow, or pass null to omit that button.
 *
 * @example
 * ```tsx
 * <Carousel items={[<img src="/one.jpg" alt="One" />, <img src="/two.jpg" alt="Two" />]} />
 * ```
 *
 * @example custom button content
 * ```tsx
 * <Carousel items={["One", "Two"]} leftButton="Back" rightButton="Next" />
 * ```
 */
export function Carousel(
  props: Omit<JSX.IntrinsicElements["div"], "children"> & {
    items: ReadonlyArray<JSX.Children>
    leftButton?: JSX.Children
    rightButton?: JSX.Children
    orientation?: "horizontal" | "vertical"
  },
) {
  const orientation = props.orientation ?? "horizontal"
  const rest = omit(props, ["class", "items", "leftButton", "rightButton", "orientation"])
  return (
    <div
      role="region"
      aria-roledescription="carousel"
      data-slot="Carousel"
      data-orientation={orientation}
      tabindex={0}
      class={`relative ${props.class ?? ""}`}
      {...rest}
    >
      <div
        data-slot="Carousel_contentTrack"
        class={`flex h-full snap-mandatory scroll-smooth [scrollbar-width:none] ${
          orientation === "vertical"
            ? "flex-col snap-y overflow-x-hidden overflow-y-auto"
            : "snap-x overflow-x-auto overflow-y-hidden"
        }`}
      >
        {props.items.map((item, index) => (
          <div
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${props.items.length}`}
            data-slot="Carousel_item"
            class="min-h-0 min-w-0 shrink-0 grow-0 basis-full snap-start"
          >
            {item}
          </div>
        ))}
      </div>
      {props.leftButton === null ? null : (
        <button
          type="button"
          aria-label="Previous slide"
          data-slot="Carousel_previous"
          data-carousel-direction="prev"
          disabled
          class={buttonClassName({
            variant: "outline",
            class: `absolute min-w-9 rounded-full px-2 ${
              orientation === "vertical"
                ? "bottom-full mb-4 left-1/2 -translate-x-1/2"
                : "top-1/2 right-full mr-4 -translate-y-1/2"
            }`,
          })}
        >
          {props.leftButton ?? (
            <Svg aria-hidden="true" class={`size-4 ${orientation === "vertical" ? "rotate-90" : ""}`}>
              <path d="m12 19-7-7 7-7M19 12H5" />
            </Svg>
          )}
        </button>
      )}
      {props.rightButton === null ? null : (
        <button
          type="button"
          aria-label="Next slide"
          data-slot="Carousel_next"
          data-carousel-direction="next"
          disabled={props.items.length < 2}
          class={buttonClassName({
            variant: "outline",
            class: `absolute min-w-9 rounded-full px-2 ${
              orientation === "vertical"
                ? "top-full mt-4 left-1/2 -translate-x-1/2"
                : "top-1/2 left-full ml-4 -translate-y-1/2"
            }`,
          })}
        >
          {props.rightButton ?? (
            <Svg aria-hidden="true" class={`size-4 ${orientation === "vertical" ? "rotate-90" : ""}`}>
              <path d="M5 12h14m-7-7 7 7-7 7" />
            </Svg>
          )}
        </button>
      )}
      <script>
        {() => {
          const d = window.document
          const script = d.currentScript
          const root = script && script.parentElement
          if (!root) return
          const track = root.querySelector<HTMLElement>("[data-slot=Carousel_contentTrack]")
          if (!track) return
          const isVertical = root.getAttribute("data-orientation") === "vertical"
          const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-carousel-direction]"))
          const step = function() {
            return isVertical ? track.clientHeight : track.clientWidth
          }
          const update = function() {
            const scroll = isVertical ? track.scrollTop : track.scrollLeft
            const max = isVertical
              ? track.scrollHeight - track.clientHeight
              : track.scrollWidth - track.clientWidth
            const previous = scroll > 1
            const next = scroll < max - 1
            for (const button of buttons) {
              button.disabled = !(button.dataset.carouselDirection === "prev" ? previous : next)
            }
          }
          track.addEventListener("scroll", update, { passive: true })
          const resize = new ResizeObserver(update)
          resize.observe(track)
          for (const slide of track.children) resize.observe(slide)
          update()
          root.addEventListener("click", function(e: any) {
            const btn = e.target.closest("[data-carousel-direction]")
            if (!btn || btn.disabled || !root.contains(btn)) return
            const dir = btn.getAttribute("data-carousel-direction") === "next" ? 1 : -1
            track.scrollBy(
              isVertical
                ? { top: dir * step(), behavior: "auto" }
                : { left: dir * step(), behavior: "auto" },
            )
          })
          root.addEventListener("keydown", function(e: any) {
            if (e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable]")) return
            if (isVertical) {
              if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
            } else {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
            }
            e.preventDefault()
            const dir = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1
            track.scrollBy(
              isVertical
                ? { top: dir * step(), behavior: "auto" }
                : { left: dir * step(), behavior: "auto" },
            )
          })
        }}
      </script>
    </div>
  )
}

function Svg(props: JSX.IntrinsicElements["svg"] & { children?: JSX.Children }) {
  const children = props.children
  const rest = omit(props, ["class", "children"])
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class ?? "size-4"}
      {...rest}
    >
      {children}
    </svg>
  )
}

function omit<T extends object, K extends keyof T>(props: T, keys: ReadonlyArray<K>): Omit<T, K> {
  const rest = { ...props }
  for (const key of keys) Reflect.deleteProperty(rest, key)
  return rest
}

const iconPaths = {
  arrow: "M7 17 17 7M7 7h10v10",
  check: "m5 12 4 4L19 6",
  chevron: "m9 5 7 7-7 7",
  code: "m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18",
  copy: "M9 9h11v11H9zM5 15H3V3h12v2",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  folder: "M3 7V4h6l2 3h10v13H3z",
  github:
    "M9 19c-5 1-5-2-7-2m14 5v-4a3.5 3.5 0 0 0-1-3c3-.4 6-1.5 6-6A5 5 0 0 0 20 5a4.6 4.6 0 0 0-.1-3S18.7 1.6 16 3a13 13 0 0 0-8 0C5.3 1.6 4.1 2 4.1 2A4.6 4.6 0 0 0 4 5a5 5 0 0 0-1 4c0 4.5 3 5.6 6 6a3.5 3.5 0 0 0-1 3v4",
  info: "M12 8h.01M12 12v4M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  mail: "M3 5h18v14H3zM3 5l9 7 9-7",
  menu: "M4 6h16M4 12h16M4 18h16",
  moon: "M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13",
  plus: "M12 5v14M5 12h14",
  search: "m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
}

export function Icon(props: { name: keyof typeof iconPaths; class?: string }) {
  return (
    <Svg stroke-width="1.6" class={props.class} aria-hidden="true">
      <path d={iconPaths[props.name]} />
    </Svg>
  )
}

function menuScript() {
  const menu = document.currentScript?.parentElement
  if (!menu) return
  const triggers = Array.from(document.querySelectorAll<HTMLElement>(`[popovertarget="${CSS.escape(menu.id)}"]`))
  const items = () =>
    Array
      .from(
        menu.querySelectorAll<HTMLElement>(
          "[role^=menuitem]:not(:disabled):not([aria-disabled=true]):not([data-disabled=true])",
        ),
      )
      .filter((item) => item.closest("[role=menu]") === menu)
  const parent = menu.parentElement?.closest<HTMLElement>("[role=menu]")
  menu.addEventListener("toggle", (event) => {
    const expanded = menu.matches(":popover-open")
    for (const trigger of triggers) trigger.setAttribute("aria-expanded", String(expanded))
    if ((event as ToggleEvent).newState === "open") items()[0]?.focus({ preventScroll: true })
  })
  menu.addEventListener("keydown", (event) => {
    if (!menu.matches(":popover-open")) return
    const choices = items()
    const active = document.activeElement as HTMLElement | null
    if (event.key === "ArrowRight" && active?.matches("[data-slot=DropdownMenu_subTrigger]")) {
      event.preventDefault()
      event.stopPropagation()
      const sub = document.getElementById(active.getAttribute("popovertarget")!)
      if (sub && !sub.matches(":popover-open")) sub.showPopover()
      sub?.querySelector<HTMLElement>("[role^=menuitem]")?.focus({ preventScroll: true })
    } else if (parent && (event.key === "ArrowLeft" || event.key === "Escape")) {
      event.preventDefault()
      event.stopPropagation()
      menu.hidePopover()
      triggers[0]?.focus({ preventScroll: true })
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && choices.length) {
      event.preventDefault()
      event.stopPropagation()
      const index = active ? choices.indexOf(active) : -1
      const next = event.key === "Home"
        ? 0
        : event.key === "End"
        ? choices.length - 1
        : event.key === "ArrowDown"
        ? (index + 1) % choices.length
        : (index - 1 + choices.length) % choices.length
      choices[next].focus({ preventScroll: true })
    }
  })
  menu.addEventListener("click", (event) => {
    const item = event.target instanceof Element ? event.target.closest("[role=menuitem]") : null
    if (
      !item || item.matches("[data-slot=DropdownMenu_subTrigger]") || item
          .closest("[role=menu]") !== menu || event
        .defaultPrevented
    ) return
    for (
      let current: HTMLElement | null = menu;
      current;
      current = current.parentElement?.closest<HTMLElement>("[role=menu]") ?? null
    ) {
      if (current.matches(":popover-open")) current.hidePopover()
    }
  })
  if (parent) {
    const wrapper = menu.parentElement!
    for (const trigger of triggers) {
      trigger.addEventListener("mouseenter", () => {
        if (parent.matches(":popover-open") && !menu.matches(":popover-open")) menu.showPopover()
      })
    }
    wrapper.addEventListener("mouseleave", (event) => {
      if (event.relatedTarget instanceof Node && wrapper.contains(event.relatedTarget)) return
      if (menu.matches(":popover-open")) menu.hidePopover()
    })
  }
}
