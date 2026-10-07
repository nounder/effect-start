import { Route } from "effect-start"
import * as Schema from "effect/Schema"
import type { JSX } from "effect-start/jsx-runtime"
import * as UI from "../ui.tsx"
import {
  Button,
  Dialog,
  DialogClose,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Kbd,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui.tsx"

const avatarImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23d4d4d8'/%3E%3Ccircle cx='40' cy='30' r='15' fill='%2371717a'/%3E%3Cellipse cx='40' cy='80' rx='30' ry='30' fill='%2371717a'/%3E%3C/svg%3E"

const createGallery = (page: number): ReadonlyArray<{
  id: string
  title: string
  group: string
  description: string
  primitive: string
  code: string
  preview: JSX.Element
}> => [
  {
    id: "button",
    title: "Button",
    group: "Essentials",
    primitive: "button",
    description: "One button. Six variants. Ready for whatever comes next.",
    code:
      "<Button>Continue</Button>\n<Button variant=\"outline\">Outline</Button>\n<Button variant=\"secondary\">Secondary</Button>\n<Button variant=\"ghost\">Ghost</Button>\n<Button variant=\"destructive\">Delete</Button>",
    preview: (
      <div class="flex max-w-lg flex-wrap items-center justify-center gap-3">
        <UI.Button>
          Continue <Icon name="arrow" />
        </UI.Button>
        <UI.Button variant="outline">
          Outline
        </UI.Button>
        <UI.Button variant="secondary">
          Secondary
        </UI.Button>
        <UI.Button variant="ghost">
          Ghost
        </UI.Button>
        <UI.Button variant="link">
          Link
        </UI.Button>
        <UI.Button variant="destructive">
          Delete
        </UI.Button>
        <UI.Button size="icon" variant="outline" aria-label="Add item">
          <Icon name="plus" />
        </UI.Button>
        <UI.Button disabled>
          Disabled
        </UI.Button>
      </div>
    ),
  },
  {
    id: "badge",
    title: "Badge",
    group: "Essentials",
    primitive: "span",
    description: "A little context, right where you need it.",
    code:
      "<Badge>Default</Badge>\n<Badge variant=\"secondary\">Secondary</Badge>\n<Badge variant=\"outline\">Outline</Badge>\n<Badge variant=\"destructive\">Destructive</Badge>",
    preview: (
      <div class="flex flex-wrap items-center justify-center gap-3">
        <UI.Badge>
          Default
        </UI.Badge>
        <UI.Badge variant="secondary">
          Secondary
        </UI.Badge>
        <UI.Badge variant="outline">
          <span class="size-1.5 rounded-full bg-emerald-500" /> Published
        </UI.Badge>
        <UI.Badge variant="destructive">
          Destructive
        </UI.Badge>
      </div>
    ),
  },
  {
    id: "card",
    title: "Card",
    group: "Essentials",
    primitive: "div",
    description: "A composable home for content, actions, and a little personality.",
    code:
      "<Card>\n  <CardHeader>\n    <CardTitle>Create a project</CardTitle>\n    <CardDescription>Start something new.</CardDescription>\n  </CardHeader>\n  <CardContent>Your content</CardContent>\n  <CardFooter><Button>Create project</Button></CardFooter>\n</Card>",
    preview: (
      <UI.Card class="w-full max-w-sm bg-background">
        <UI.CardHeader>
          <UI.CardTitle>
            Create a project
          </UI.CardTitle>
          <UI.CardDescription>
            Give your next idea a place to grow.
          </UI.CardDescription>
          <UI.CardAction>
            <UI.Badge variant="outline">
              New
            </UI.Badge>
          </UI.CardAction>
        </UI.CardHeader>
        <UI.CardContent>
          <UI.Field>
            <UI.FieldLabel for="project-name">
              Name
            </UI.FieldLabel>
            <UI.Input id="project-name" placeholder="My new project" />
          </UI.Field>
        </UI.CardContent>
        <UI.CardFooter class="justify-between">
          <UI.Button variant="ghost">
            Cancel
          </UI.Button>
          <UI.Button data-demo-toast="Project created">
            Create project
          </UI.Button>
        </UI.CardFooter>
      </UI.Card>
    ),
  },
  {
    id: "avatar",
    title: "Avatar",
    group: "Essentials",
    primitive: "img + span",
    description: "Images, initials, and the people behind your product.",
    code:
      "<Avatar>\n  <AvatarImage src=\"/avatar.svg\" alt=\"Alex\" />\n  <AvatarFallback>AL</AvatarFallback>\n</Avatar>\n<AvatarGroup>…</AvatarGroup>",
    preview: (
      <div class="flex flex-wrap items-center gap-8">
        <UI.Avatar size="lg">
          <UI.AvatarImage src={avatarImage} alt="Alex's avatar" />
          <UI.AvatarFallback>
            AL
          </UI.AvatarFallback>
          <UI.AvatarBadge>
            <Icon name="check" class="size-2" />
          </UI.AvatarBadge>
        </UI.Avatar>
        <UI.AvatarGroup>
          <UI.Avatar>
            <UI.AvatarFallback>
              AL
            </UI.AvatarFallback>
          </UI.Avatar>
          <UI.Avatar>
            <UI.AvatarFallback class="bg-stone-200 text-stone-700">
              JD
            </UI.AvatarFallback>
          </UI.Avatar>
          <UI.Avatar>
            <UI.AvatarFallback class="bg-zinc-300 text-zinc-700">
              SK
            </UI.AvatarFallback>
          </UI.Avatar>
          <UI.AvatarGroupCount>
            +3
          </UI.AvatarGroupCount>
        </UI.AvatarGroup>
      </div>
    ),
  },
  {
    id: "kbd",
    title: "Keyboard",
    group: "Essentials",
    primitive: "kbd",
    description: "Make keyboard shortcuts easy to discover.",
    code: "<KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup>",
    preview: (
      <div class="flex items-center gap-4 text-sm text-muted-foreground">
        Open the component search{" "}
        <UI.KbdGroup>
          <UI.Kbd>
            ⌘
          </UI.Kbd>
          <UI.Kbd>
            K
          </UI.Kbd>
        </UI.KbdGroup>
      </div>
    ),
  },
  {
    id: "button-group",
    title: "Button Group",
    group: "Essentials",
    primitive: "role=group",
    description: "Bring neighboring actions together.",
    code:
      "<ButtonGroup>\n  <Button variant=\"outline\">Save</Button>\n  <ButtonGroupSeparator />\n  <Button variant=\"outline\">More</Button>\n</ButtonGroup>",
    preview: (
      <div class="flex flex-wrap gap-6">
        <UI.ButtonGroup>
          <UI.Button variant="outline">
            Archive
          </UI.Button>
          <UI.ButtonGroupSeparator />
          <UI.Button variant="outline">
            Report
          </UI.Button>
        </UI.ButtonGroup>
        <UI.ButtonGroup>
          <UI.ButtonGroupText>
            https://
          </UI.ButtonGroupText>
          <UI.Input aria-label="Website domain" placeholder="example.com" class="w-36" />
        </UI.ButtonGroup>
      </div>
    ),
  },
  {
    id: "input",
    title: "Input",
    group: "Forms",
    primitive: "input",
    description: "A familiar text field with thoughtful focus and validation states.",
    code: "<Label for=\"email\">Email</Label>\n<Input id=\"email\" type=\"email\" placeholder=\"you@example.com\" />",
    preview: (
      <div class="grid w-full max-w-sm gap-3">
        <UI.Label for="email-demo">
          Email address
        </UI.Label>
        <UI.Input id="email-demo" type="email" placeholder="you@example.com" />
        <UI.Input disabled placeholder="A disabled input" aria-label="Disabled input example" />
      </div>
    ),
  },
  {
    id: "textarea",
    title: "Textarea",
    group: "Forms",
    primitive: "textarea",
    description: "Room for a longer thought. Resizable by the browser.",
    code: "<Textarea placeholder=\"Tell us a little about yourself.\" rows={3} />",
    preview: (
      <div class="grid w-full max-w-sm gap-3">
        <UI.Label for="bio-demo">
          Your bio
        </UI.Label>
        <UI.Textarea id="bio-demo" placeholder="Tell us a little about yourself." rows={3} />
      </div>
    ),
  },
  {
    id: "label",
    title: "Label",
    group: "Forms",
    primitive: "label",
    description: "Connect every control to a clear, clickable label.",
    code: "<Label for=\"label-demo\">Display name</Label>\n<Input id=\"label-demo\" placeholder=\"Alex Lee\" />",
    preview: (
      <div class="grid w-full max-w-sm gap-3">
        <UI.Label for="label-demo">
          Display name{" "}
          <span class="text-destructive">
            *
          </span>
        </UI.Label>
        <UI.Input id="label-demo" placeholder="Alex Lee" required />
      </div>
    ),
  },
  {
    id: "field",
    title: "Field",
    group: "Forms",
    primitive: "fieldset + label",
    description: "Labels, hints, and validation messages that belong together.",
    code:
      "<FieldSet>\n  <FieldLegend>Profile</FieldLegend>\n  <FieldGroup>\n    <Field>\n      <FieldLabel for=\"username\">Username</FieldLabel>\n      <Input id=\"username\" required />\n      <FieldDescription>Your public handle.</FieldDescription>\n    </Field>\n  </FieldGroup>\n</FieldSet>",
    preview: (
      <form class="w-full max-w-sm rounded-lg border bg-background p-5" data-demo-form>
        <UI.FieldSet>
          <UI.FieldLegend>
            Profile
          </UI.FieldLegend>
          <UI.FieldGroup>
            <UI.Field>
              <UI.FieldLabel for="username-demo">
                Username
              </UI.FieldLabel>
              <UI.Input id="username-demo" placeholder="alexlee" required minlength={3} />
              <UI.FieldDescription>
                At least 3 characters. This is your public handle.
              </UI.FieldDescription>
            </UI.Field>
            <UI.FieldSeparator>
              Preferences
            </UI.FieldSeparator>
            <UI.Field orientation="horizontal">
              <UI.Checkbox id="field-updates" />
              <UI.FieldContent>
                <UI.FieldLabel for="field-updates">
                  <UI.FieldTitle>
                    Product updates
                  </UI.FieldTitle>
                </UI.FieldLabel>
                <UI.FieldDescription>
                  News worth opening your inbox for.
                </UI.FieldDescription>
              </UI.FieldContent>
            </UI.Field>
            <UI.Field data-invalid>
              <UI.FieldLabel for="invalid-demo">
                Example validation state
              </UI.FieldLabel>
              <UI.Input id="invalid-demo" value="a" aria-invalid="true" aria-describedby="invalid-error" />
              <UI.FieldError id="invalid-error">
                Please use at least 3 characters.
              </UI.FieldError>
            </UI.Field>
            <UI.Button type="submit">
              Save profile
            </UI.Button>
          </UI.FieldGroup>
        </UI.FieldSet>
      </form>
    ),
  },
  {
    id: "input-group",
    title: "Input Group",
    group: "Forms",
    primitive: "input + adornments",
    description: "Add context and useful actions, inside the field.",
    code:
      "<InputGroup>\n  <InputGroupAddon><InputGroupText>https://</InputGroupText></InputGroupAddon>\n  <InputGroupInput placeholder=\"example.com\" />\n</InputGroup>",
    preview: (
      <div class="grid w-full max-w-sm gap-4">
        <UI.InputGroup>
          <UI.InputGroupAddon>
            <Icon name="search" />
          </UI.InputGroupAddon>
          <UI.InputGroupInput placeholder="Search components…" aria-label="Search input example" />
          <UI.InputGroupAddon align="inline-end">
            <UI.InputGroupText>
              ⌘ K
            </UI.InputGroupText>
          </UI.InputGroupAddon>
        </UI.InputGroup>
        <UI.InputGroup>
          <UI.InputGroupTextarea placeholder="Ask a question…" aria-label="Question" />
          <UI.InputGroupAddon align="block-end">
            <UI.InputGroupText>
              Plain text supported
            </UI.InputGroupText>
            <UI.InputGroupButton
              class="ml-auto"
              variant="default"
              size="icon-xs"
              aria-label="Send question"
              data-demo-toast="Question sent"
            >
              <Icon name="arrow" />
            </UI.InputGroupButton>
          </UI.InputGroupAddon>
        </UI.InputGroup>
      </div>
    ),
  },
  {
    id: "checkbox",
    title: "Checkbox",
    group: "Forms",
    primitive: "input[type=checkbox]",
    description: "The browser handles the checked state, forms, and keyboard input.",
    code: "<Checkbox id=\"terms\" />\n<Label for=\"terms\">Accept terms and conditions</Label>",
    preview: (
      <div class="space-y-5">
        <div class="flex items-center gap-3">
          <UI.Checkbox id="terms-demo" />
          <UI.Label for="terms-demo">
            Accept terms and conditions
          </UI.Label>
        </div>
        <div class="flex items-center gap-3">
          <UI.Checkbox id="checked-demo" checked />
          <UI.Label for="checked-demo">
            Keep me signed in
          </UI.Label>
        </div>
        <div class="flex items-center gap-3">
          <UI.Checkbox id="disabled-check" disabled />
          <UI.Label for="disabled-check">
            Unavailable option
          </UI.Label>
        </div>
      </div>
    ),
  },
  {
    id: "switch",
    title: "Switch",
    group: "Forms",
    primitive: "input[type=checkbox]",
    description: "A small switch for an immediate preference.",
    code: "<Switch id=\"airplane\" />\n<Label for=\"airplane\">Airplane mode</Label>",
    preview: (
      <div class="w-full max-w-xs space-y-5">
        <div class="flex items-center justify-between">
          <UI.Label for="airplane-demo">
            Airplane mode
          </UI.Label>
          <UI.Switch id="airplane-demo" role="switch" />
        </div>
        <div class="flex items-center justify-between">
          <UI.Label for="notifications-demo">
            Notifications
          </UI.Label>
          <UI.Switch id="notifications-demo" role="switch" checked />
        </div>
        <div class="flex items-center justify-between">
          <UI.Label for="small-switch">
            Compact switch
          </UI.Label>
          <UI.Switch id="small-switch" role="switch" size="sm" />
        </div>
      </div>
    ),
  },
  {
    id: "radio-group",
    title: "Radio Group",
    group: "Forms",
    primitive: "input[type=radio]",
    description: "One choice at a time, with native arrow-key navigation.",
    code:
      "<RadioGroup name=\"plan\" aria-label=\"Plan\">\n  <RadioGroupItem name=\"plan\" value=\"free\" checked />\n  <RadioGroupItem name=\"plan\" value=\"pro\" />\n</RadioGroup>",
    preview: (
      <UI.RadioGroup name="plan-demo" aria-label="Choose a plan">
        <div class="flex items-center gap-3">
          <UI.RadioGroupItem id="plan-free" name="plan-demo" value="free" checked />
          <UI.Label for="plan-free">
            Free{" "}
            <span class="font-normal text-muted-foreground">
              — for side projects
            </span>
          </UI.Label>
        </div>
        <div class="flex items-center gap-3">
          <UI.RadioGroupItem id="plan-pro" name="plan-demo" value="pro" />
          <UI.Label for="plan-pro">
            Pro{" "}
            <span class="font-normal text-muted-foreground">
              — for your next big thing
            </span>
          </UI.Label>
        </div>
        <div class="flex items-center gap-3">
          <UI.RadioGroupItem id="plan-team" name="plan-demo" value="team" />
          <UI.Label for="plan-team">
            Team{" "}
            <span class="font-normal text-muted-foreground">
              — better together
            </span>
          </UI.Label>
        </div>
      </UI.RadioGroup>
    ),
  },
  {
    id: "slider",
    title: "Slider",
    group: "Forms",
    primitive: "input[type=range]",
    description: "Drag, tap, or use the arrow keys to find the right value.",
    code:
      "<Slider min={0} max={100} value={65} aria-label=\"Volume\" />\n<Slider orientation=\"vertical\" min={0} max={100} value={50} aria-label=\"Level\" />\n<Slider list=\"slider-stops\" min={0} max={100} value={40} aria-label=\"With markers\" />\n<Slider orientation=\"vertical\" list=\"slider-stops\" min={0} max={100} value={40} aria-label=\"Vertical with markers\" />\n<datalist id=\"slider-stops\">\n  <option value=\"0\" />\n  <option value=\"25\" />\n  <option value=\"50\" />\n  <option value=\"75\" />\n  <option value=\"100\" />\n</datalist>",
    preview: (
      <div class="grid w-full max-w-2xl grid-cols-2 gap-y-8 sm:grid-cols-[minmax(0,1fr)_5rem_5rem] sm:pr-8">
        <div class="col-span-2 flex min-w-0 flex-col gap-8 sm:col-span-1 sm:mr-8">
          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <UI.Label for="volume-demo">
                Volume
              </UI.Label>
              <output for="volume-demo" id="volume-output" class="font-mono text-muted-foreground">
                65%
              </output>
            </div>
            <UI.Slider id="volume-demo" class="h-4" min={0} max={100} value={65} step={1} data-output="volume-output" />
          </div>
          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <UI.Label for="markers-demo">
                With markers
              </UI.Label>
              <output for="markers-demo" id="markers-output" class="font-mono text-muted-foreground">
                40%
              </output>
            </div>
            <UI.Slider
              id="markers-demo"
              class="h-4"
              list="slider-stops"
              min={0}
              max={100}
              value={40}
              step={1}
              data-output="markers-output"
            />
            <datalist id="slider-stops" class="flex justify-between text-xs text-muted-foreground">
              {[0, 25, 50, 75, 100].map((value) => (
                <option value={value} label={`${value}%`}>
                  {value}%
                </option>
              ))}
            </datalist>
          </div>
        </div>
        <div class="grid w-20 grid-cols-1 grid-rows-[auto_1fr_auto] justify-items-center gap-3 justify-self-end">
          <UI.Label for="vertical-demo" class="h-5">
            Vertical
          </UI.Label>
          <UI.Slider
            id="vertical-demo"
            orientation="vertical"
            min={0}
            max={100}
            value={50}
            step={1}
            data-output="vertical-output"
          />
          <output for="vertical-demo" id="vertical-output" class="font-mono text-sm text-muted-foreground">
            50%
          </output>
        </div>
        <div class="grid w-20 grid-cols-1 grid-rows-[auto_1fr_auto] justify-items-center gap-3 justify-self-start">
          <UI.Label for="vertical-markers-demo" class="h-5 whitespace-nowrap">
            With markers
          </UI.Label>
          <div class="relative flex">
            <UI.Slider
              id="vertical-markers-demo"
              orientation="vertical"
              list="vertical-slider-stops"
              min={0}
              max={100}
              value={40}
              step={1}
              data-output="vertical-markers-output"
            />
            <datalist id="vertical-slider-stops" class="absolute left-full ml-3 flex h-40 flex-col justify-between text-xs text-muted-foreground">
              {[100, 75, 50, 25, 0].map((value) => (
                <option value={value} label={`${value}%`}>
                  {value}%
                </option>
              ))}
            </datalist>
          </div>
          <output
            for="vertical-markers-demo"
            id="vertical-markers-output"
            class="font-mono text-sm text-muted-foreground"
          >
            40%
          </output>
        </div>
      </div>
    ),
  },
  {
    id: "native-select",
    title: "Native Select",
    group: "Forms",
    primitive: "select + option",
    description: "The platform's own picker, with a consistent coat of paint.",
    code:
      "<NativeSelect aria-label=\"Framework\">\n  <option value=\"\">Select a framework</option>\n  <optgroup label=\"Server\">\n    <option value=\"effect\">effect-start</option>\n  </optgroup>\n</NativeSelect>",
    preview: (
      <UI.NativeSelect aria-label="Framework">
        <option value="">
          Select a framework
        </option>
        <optgroup label="Server first">
          <option value="effect">
            effect-start
          </option>
          <option value="astro">
            Astro
          </option>
        </optgroup>
        <optgroup label="Client first">
          <option value="react">
            React
          </option>
          <option value="vue">
            Vue
          </option>
        </optgroup>
      </UI.NativeSelect>
    ),
  },
  {
    id: "combobox",
    title: "Combobox",
    group: "Forms",
    primitive: "input + datalist",
    description: "Suggestions when you want them. Free text when you need it.",
    code:
      "<Combobox\n  listId=\"frameworks\"\n  placeholder=\"Choose a framework…\"\n  options={[\"effect-start\", \"Astro\", \"Svelte\", \"React\", \"Vue\"]}\n/>",
    preview: (
      <div class="grid w-full max-w-sm gap-3">
        <UI.Label for="framework-demo">
          Framework
        </UI.Label>
        <UI.Combobox
          id="framework-demo"
          listId="framework-options"
          placeholder="Choose or type a framework…"
          options={["effect-start", "Astro", "Svelte", "React", "Vue"]}
        />
        <p class="text-xs text-muted-foreground">
          A native datalist. Your own answer is welcome, too.
        </p>
      </div>
    ),
  },
  {
    id: "toggle",
    title: "Toggle",
    group: "Forms",
    primitive: "input[type=checkbox]",
    description: "A two-state control, with no state management to install.",
    code: "<Toggle variant=\"outline\" aria-label=\"Bold\"><strong>B</strong></Toggle>",
    preview: (
      <div class="flex gap-3">
        <UI.Toggle variant="outline" aria-label="Bold">
          <strong>
            B
          </strong>
        </UI.Toggle>
        <UI.Toggle variant="outline" aria-label="Italic">
          <em>
            I
          </em>
        </UI.Toggle>
        <UI.Toggle variant="outline" aria-label="Underline" checked>
          <span class="underline">
            U
          </span>
        </UI.Toggle>
      </div>
    ),
  },
  {
    id: "toggle-group",
    title: "Toggle Group",
    group: "Forms",
    primitive: "radio or checkbox",
    description: "Group formatting options or make a single selection.",
    code:
      "<ToggleGroup variant=\"outline\" aria-label=\"Alignment\">\n  <ToggleGroupItem type=\"radio\" name=\"align\" value=\"left\" checked>Left</ToggleGroupItem>\n  <ToggleGroupItem type=\"radio\" name=\"align\" value=\"center\">Center</ToggleGroupItem>\n</ToggleGroup>",
    preview: (
      <UI.ToggleGroup variant="outline" aria-label="Text alignment">
        <UI.ToggleGroupItem variant="outline" type="radio" name="alignment-demo" value="left" checked>
          Left
        </UI.ToggleGroupItem>
        <UI.ToggleGroupItem variant="outline" type="radio" name="alignment-demo" value="center">
          Center
        </UI.ToggleGroupItem>
        <UI.ToggleGroupItem variant="outline" type="radio" name="alignment-demo" value="right">
          Right
        </UI.ToggleGroupItem>
      </UI.ToggleGroup>
    ),
  },
  {
    id: "command",
    title: "Command",
    group: "Overlays",
    primitive: "input + listbox",
    description: "Search 100 actions as you type. Keep your selection as results update.",
    code:
      "<Command id=\"actions\">\n  <CommandInput\n    aria-label=\"Search actions\"\n    placeholder=\"Search 100 actions…\"\n    data-init={(e) => e.get(\"/command\")}\n    {...{\n      \"data-on:input__throttle.200ms.trailing\": (e) =>\n        e.get(`/command?q=${encodeURIComponent(e.currentTarget.value)}`),\n    }}\n  />\n  <CommandList id=\"command-demo-results\" aria-label=\"Actions\" class=\"h-80\" />\n</Command>",
    preview: (
      <UI.Command id="command-demo" class="w-full max-w-sm border shadow-sm">
        <UI.CommandInput
          aria-label="Search actions"
          placeholder="Search 100 actions…"
          data-init={(event) => event.get("/command")}
          {...{
            "data-on:input__throttle.200ms.trailing": (event) =>
              event.get(`/command?q=${encodeURIComponent(event.currentTarget.value)}`),
          }}
        />
        <UI.CommandList id="command-demo-results" aria-label="Actions" class="h-80" />
      </UI.Command>
    ),
  },
  {
    id: "dialog",
    title: "Dialog",
    group: "Overlays",
    primitive: "dialog + commandfor",
    description: "A focused moment. Native focus trapping, Escape, and an inert background.",
    code:
      "<DialogTrigger for=\"edit-profile\" variant=\"outline\">Edit profile</DialogTrigger>\n<Dialog id=\"edit-profile\">\n  <DialogHeader>\n    <DialogTitle>Edit profile</DialogTitle>\n    <DialogDescription>Make it yours.</DialogDescription>\n  </DialogHeader>\n  <DialogClose for=\"edit-profile\" />\n</Dialog>",
    preview: (
      <>
        <UI.DialogTrigger for="profile-dialog" variant="outline">
          Edit profile
        </UI.DialogTrigger>
        <UI.Dialog aria-label="Edit profile" id="profile-dialog">
          <UI.DialogHeader>
            <UI.DialogTitle>
              Edit profile
            </UI.DialogTitle>
            <UI.DialogDescription>
              Make changes to your profile here. Click save when you're done.
            </UI.DialogDescription>
          </UI.DialogHeader>
          <form method="dialog" class="grid gap-5">
            <UI.Field>
              <UI.FieldLabel for="dialog-name">
                Name
              </UI.FieldLabel>
              <UI.Input id="dialog-name" value="Alex Lee" required />
            </UI.Field>
            <UI.DialogFooter>
              <UI.Button type="submit">
                Save changes
              </UI.Button>
            </UI.DialogFooter>
          </form>
          <UI.DialogClose for="profile-dialog" />
        </UI.Dialog>
      </>
    ),
  },
  {
    id: "alert-dialog",
    title: "Alert Dialog",
    group: "Overlays",
    primitive: "dialog",
    description: "Pause for confirmation before an important action.",
    code:
      "<DialogTrigger for=\"confirm\" variant=\"outline\">Delete project</DialogTrigger>\n<AlertDialog id=\"confirm\">\n  <AlertDialogHeader>\n    <AlertDialogTitle>Are you sure?</AlertDialogTitle>\n    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>\n  </AlertDialogHeader>\n  <AlertDialogFooter>\n    <AlertDialogAction for=\"confirm\">Confirm</AlertDialogAction>\n  </AlertDialogFooter>\n</AlertDialog>",
    preview: (
      <>
        <UI.DialogTrigger for="delete-dialog" variant="outline">
          Delete project
        </UI.DialogTrigger>
        <UI.AlertDialog aria-label="Delete this project?" id="delete-dialog">
          <UI.AlertDialogHeader>
            <UI.AlertDialogMedia>
              <Icon name="folder" class="size-8" />
            </UI.AlertDialogMedia>
            <UI.AlertDialogTitle>
              Delete this project?
            </UI.AlertDialogTitle>
            <UI.AlertDialogDescription>
              This is a demo. Confirming will close the dialog without deleting anything.
            </UI.AlertDialogDescription>
          </UI.AlertDialogHeader>
          <UI.AlertDialogFooter>
            <UI.AlertDialogAction for="delete-dialog" variant="outline">
              Cancel
            </UI.AlertDialogAction>
            <UI.AlertDialogAction for="delete-dialog" variant="destructive">
              Delete project
            </UI.AlertDialogAction>
          </UI.AlertDialogFooter>
        </UI.AlertDialog>
      </>
    ),
  },
  {
    id: "sheet",
    title: "Sheet",
    group: "Overlays",
    primitive: "dialog",
    description: "Extra context that slides in from the edge of the screen.",
    code:
      "<DialogTrigger for=\"settings\" variant=\"outline\">Settings</DialogTrigger>\n<Sheet id=\"settings\" side=\"right\">\n  <SheetHeader><SheetTitle>Settings</SheetTitle></SheetHeader>\n</Sheet>",
    preview: (
      <>
        <UI.DialogTrigger for="settings-sheet" variant="outline">
          <Icon name="settings" /> Open settings
        </UI.DialogTrigger>
        <UI.Sheet aria-label="Workspace settings" id="settings-sheet" side="right">
          <UI.SheetHeader>
            <UI.SheetTitle>
              Workspace settings
            </UI.SheetTitle>
            <UI.SheetDescription>
              A little housekeeping for your workspace.
            </UI.SheetDescription>
          </UI.SheetHeader>
          <div class="px-4">
            <UI.Field>
              <UI.FieldLabel for="workspace-name">
                Workspace name
              </UI.FieldLabel>
              <UI.Input id="workspace-name" value="Acme Studio" />
            </UI.Field>
          </div>
          <UI.SheetFooter>
            <UI.Button commandfor="settings-sheet" command="close">
              Save changes
            </UI.Button>
          </UI.SheetFooter>
        </UI.Sheet>
      </>
    ),
  },
  {
    id: "drawer",
    title: "Drawer",
    group: "Overlays",
    primitive: "dialog",
    description: "A bottom panel with plenty of room for the next step.",
    code:
      "<DialogTrigger for=\"goal\" variant=\"outline\">Set a goal</DialogTrigger>\n<Drawer id=\"goal\">\n  <SheetHeader><SheetTitle>Your daily goal</SheetTitle></SheetHeader>\n  <DialogClose for=\"goal\" />\n</Drawer>",
    preview: (
      <>
        <UI.DialogTrigger for="goal-drawer" variant="outline">
          Set a goal
        </UI.DialogTrigger>
        <UI.Drawer aria-label="Your daily goal" id="goal-drawer" class="mx-auto">
          <div class="mx-auto w-full max-w-sm">
            <UI.SheetHeader>
              <UI.SheetTitle>
                Your daily goal
              </UI.SheetTitle>
              <UI.SheetDescription>
                Make a little progress every day.
              </UI.SheetDescription>
            </UI.SheetHeader>
            <div class="px-4 py-8 text-center">
              <span class="text-6xl font-semibold tracking-tighter">
                350
              </span>
              <p class="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
                minutes of focus / week
              </p>
            </div>
            <UI.SheetFooter>
              <UI.Button commandfor="goal-drawer" command="close">
                Set goal
              </UI.Button>
            </UI.SheetFooter>
          </div>
          <UI.DialogClose for="goal-drawer" />
        </UI.Drawer>
      </>
    ),
  },
  {
    id: "popover",
    title: "Popover",
    group: "Overlays",
    primitive: "popover + CSS anchors",
    description: "A small surface, anchored to its trigger. Click outside to dismiss.",
    code:
      "<PopoverTrigger for=\"dimensions\" variant=\"outline\">Dimensions</PopoverTrigger>\n<Popover id=\"dimensions\">\n  <div class=\"flex flex-col gap-1 text-sm\">\n    <h3 class=\"font-medium\">Dimensions</h3>\n    <p class=\"text-muted-foreground\">Set the size of your canvas.</p>\n  </div>\n</Popover>",
    preview: (
      <>
        <UI.PopoverTrigger for="dimensions-popover" variant="outline">
          Set dimensions
        </UI.PopoverTrigger>
        <UI.Popover id="dimensions-popover">
          <div class="flex flex-col gap-1 text-sm">
            <h3 class="font-medium">
              Dimensions
            </h3>
            <p class="text-muted-foreground">
              Set the size of your canvas.
            </p>
          </div>
          <div class="mt-4 grid grid-cols-[70px_1fr] items-center gap-3">
            <UI.Label for="canvas-width">
              Width
            </UI.Label>
            <UI.Input id="canvas-width" value="100%" />
            <UI.Label for="canvas-height">
              Height
            </UI.Label>
            <UI.Input id="canvas-height" value="240px" />
          </div>
        </UI.Popover>
      </>
    ),
  },
  {
    id: "dropdown-menu",
    title: "Dropdown Menu",
    group: "Overlays",
    primitive: "popover",
    description: "Actions, preferences, and nested menus. Arrow keys welcome.",
    code:
      "<PopoverTrigger for=\"account\" variant=\"outline\">My account</PopoverTrigger>\n<DropdownMenu id=\"account\">\n  <DropdownMenuLabel>My account</DropdownMenuLabel>\n  <DropdownMenuItem>Profile</DropdownMenuItem>\n  <DropdownMenuSeparator />\n  <DropdownMenuCheckboxItem checked>Show status</DropdownMenuCheckboxItem>\n</DropdownMenu>",
    preview: (
      <>
        <UI.PopoverTrigger for="account-menu" variant="outline" aria-haspopup="menu" aria-expanded="false">
          My account <Icon name="chevron" class="size-3 rotate-90" />
        </UI.PopoverTrigger>
        <UI.DropdownMenu id="account-menu" class="w-52">
          <UI.DropdownMenuLabel>
            My account
          </UI.DropdownMenuLabel>
          <UI.DropdownMenuSeparator />
          <UI.DropdownMenuGroup>
            <UI.DropdownMenuItem data-demo-toast="Profile selected">
              Profile<UI.DropdownMenuShortcut>
                ⇧⌘P
              </UI.DropdownMenuShortcut>
            </UI.DropdownMenuItem>
            <UI.DropdownMenuItem data-demo-toast="Settings selected">
              Settings<UI.DropdownMenuShortcut>
                ⌘S
              </UI.DropdownMenuShortcut>
            </UI.DropdownMenuItem>
          </UI.DropdownMenuGroup>
          <UI.DropdownMenuSeparator />
          <UI.DropdownMenuCheckboxItem checked>
            Show status
          </UI.DropdownMenuCheckboxItem>
          <UI.DropdownMenuRadioGroup aria-label="Density">
            <UI.DropdownMenuRadioItem checked>
              Comfortable
            </UI.DropdownMenuRadioItem>
            <UI.DropdownMenuRadioItem>
              Compact
            </UI.DropdownMenuRadioItem>
          </UI.DropdownMenuRadioGroup>
          <UI.DropdownMenuSub>
            <UI.DropdownMenuSubTrigger for="invite-menu">
              Invite people
            </UI.DropdownMenuSubTrigger>
            <UI.DropdownMenuSubContent id="invite-menu" for="invite-menu">
              <UI.DropdownMenuItem data-demo-toast="Invitation copied">
                Copy invite link
              </UI.DropdownMenuItem>
              <UI.DropdownMenuItem data-demo-toast="Email invitation selected">
                Email
              </UI.DropdownMenuItem>
            </UI.DropdownMenuSubContent>
          </UI.DropdownMenuSub>
          <UI.DropdownMenuSeparator />
          <UI.DropdownMenuItem variant="destructive" data-demo-toast="Signed out (demo)">
            Sign out
          </UI.DropdownMenuItem>
        </UI.DropdownMenu>
      </>
    ),
  },
  {
    id: "context-menu",
    title: "Context Menu",
    group: "Overlays",
    primitive: "popover + contextmenu",
    description: "Useful actions, right where you right-click.",
    code:
      "<DropdownMenu id=\"context-actions\">\n  <DropdownMenuItem>Copy</DropdownMenuItem>\n</DropdownMenu>\n<ContextMenu>\n  <ContextMenuTrigger for=\"context-actions\">Right-click here</ContextMenuTrigger>\n</ContextMenu>",
    preview: (
      <>
        <UI.DropdownMenu id="context-actions" class="w-44">
          <UI.DropdownMenuItem data-demo-toast="Copied">
            Copy<UI.DropdownMenuShortcut>
              ⌘C
            </UI.DropdownMenuShortcut>
          </UI.DropdownMenuItem>
          <UI.DropdownMenuItem data-demo-toast="Pasted (demo)">
            Paste<UI.DropdownMenuShortcut>
              ⌘V
            </UI.DropdownMenuShortcut>
          </UI.DropdownMenuItem>
          <UI.DropdownMenuSeparator />
          <UI.DropdownMenuItem data-demo-toast="Inspect selected">
            Inspect
          </UI.DropdownMenuItem>
        </UI.DropdownMenu>
        <UI.ContextMenu>
          <UI.ContextMenuTrigger
            for="context-actions"
            tabindex={0}
            aria-label="Right-click for actions"
            class="flex h-36 w-full max-w-sm items-center justify-center rounded-md border border-dashed bg-background text-sm text-muted-foreground"
          >
            Right-click here
          </UI.ContextMenuTrigger>
        </UI.ContextMenu>
      </>
    ),
  },
  {
    id: "hover-card",
    title: "Hover Card",
    group: "Overlays",
    primitive: "popover=manual",
    description: "A little more information, on hover or focus.",
    code:
      "<Button id=\"author\" variant=\"link\">@effect</Button>\n<HoverCard id=\"author-card\" for=\"author\">Building better software.</HoverCard>",
    preview: (
      <>
        <UI.Button id="author-hover" variant="link">
          @effect-start
        </UI.Button>
        <UI.HoverCard id="author-card" for="author-hover">
          <div class="flex gap-4">
            <UI.Avatar>
              <UI.AvatarFallback>
                es
              </UI.AvatarFallback>
            </UI.Avatar>
            <div class="space-y-1">
              <h4 class="text-sm font-semibold">
                effect-start
              </h4>
              <p class="text-sm text-muted-foreground">
                A small start for ambitious ideas. Built with Effect and Bun.
              </p>
              <p class="pt-2 text-xs text-muted-foreground">
                Open source. HTML first.
              </p>
            </div>
          </div>
        </UI.HoverCard>
      </>
    ),
  },
  {
    id: "tooltip",
    title: "Tooltip",
    group: "Overlays",
    primitive: "popover=manual",
    description: "Short, helpful hints on hover and keyboard focus.",
    code:
      "<Button id=\"download\" variant=\"outline\">Download</Button>\n<Tooltip id=\"download-tip\" for=\"download\">Download the source</Tooltip>",
    preview: (
      <>
        <UI.Button id="download-tooltip" variant="outline" size="icon" aria-label="Download source">
          <Icon name="download" />
        </UI.Button>
        <UI.Tooltip id="download-tip" for="download-tooltip">
          Download the source
        </UI.Tooltip>
      </>
    ),
  },
  {
    id: "breadcrumb",
    title: "Breadcrumb",
    group: "Navigation",
    primitive: "nav + ol",
    description: "A clear path back to where you started.",
    code:
      "<Breadcrumb items={[\n  { label: \"Home\", url: \"/\" },\n  { label: \"Components\", current: true },\n]} />",
    preview: (
      <UI.Breadcrumb items={[
        { label: "Home", url: "#top" },
        { label: "…" },
        { label: "Components", url: "#overview" },
        { label: "Breadcrumb", current: true },
      ]} />
    ),
  },
  {
    id: "pagination",
    title: "Pagination",
    group: "Navigation",
    primitive: "nav + a",
    description: "Keep large collections easy to explore.",
    code:
      "<Pagination items={[\n  { label: \"Previous\", url: \"?page=4\" },\n  { label: 1, url: \"?page=1\" },\n  { label: \"…\" },\n  { label: 4, url: \"?page=4\" },\n  { label: 5, url: \"?page=5\", current: true },\n  { label: 6, url: \"?page=6\" },\n  { label: \"…\" },\n  { label: 10, url: \"?page=10\" },\n  { label: \"Next\", url: \"?page=6\" },\n]} />",
    preview: (
      <UI.Pagination
        aria-label="Pagination example"
        onclick={(event) => event.preventDefault()}
        items={[
          { label: "Previous", url: `?page=${page - 1}#pagination`, disabled: page === 1 },
          ...Array.from({ length: 10 }, (_, index) => index + 1)
            .filter((number) => number === 1 || number === 10 || Math.abs(number - page) <= 1)
            .flatMap((number, index, pages) => [
              ...(index > 0 && number - pages[index - 1]! > 1 ? [{ label: "…" }] : []),
              { label: number, url: `?page=${number}#pagination`, current: number === page },
            ]),
          { label: "Next", url: `?page=${page + 1}#pagination`, disabled: page === 10 },
        ]}
      />
    ),
  },
  {
    id: "tabs",
    title: "Tabs",
    group: "Navigation",
    primitive: "input[type=radio]",
    description: "Related content, a single view at a time.",
    code:
      "<Tabs name=\"settings\">\n  <TabsList>\n    <TabsTrigger name=\"settings\" value=\"account\" checked>Account</TabsTrigger>\n    <TabsTrigger name=\"settings\" value=\"password\">Password</TabsTrigger>\n  </TabsList>\n  <TabsContent name=\"settings\" value=\"account\">Account settings</TabsContent>\n  <TabsContent name=\"settings\" value=\"password\">Password settings</TabsContent>\n</Tabs>",
    preview: (
      <UI.Tabs name="settings-demo" class="w-full max-w-sm">
        <UI.TabsList class="w-full">
          <UI.TabsTrigger name="settings-demo" value="account" checked>
            Account
          </UI.TabsTrigger>
          <UI.TabsTrigger name="settings-demo" value="password">
            Password
          </UI.TabsTrigger>
        </UI.TabsList>
        <UI.TabsContent name="settings-demo" value="account">
          <UI.Card class="bg-background">
            <UI.CardHeader>
              <UI.CardTitle>
                Account
              </UI.CardTitle>
              <UI.CardDescription>
                Your public profile, all in one place.
              </UI.CardDescription>
            </UI.CardHeader>
            <UI.CardContent>
              <UI.Input placeholder="Alex Lee" aria-label="Account name" />
            </UI.CardContent>
            <UI.CardFooter>
              <UI.Button data-demo-toast="Account saved">
                Save changes
              </UI.Button>
            </UI.CardFooter>
          </UI.Card>
        </UI.TabsContent>
        <UI.TabsContent name="settings-demo" value="password">
          <UI.Card class="bg-background">
            <UI.CardHeader>
              <UI.CardTitle>
                Password
              </UI.CardTitle>
              <UI.CardDescription>
                Choose something only you know.
              </UI.CardDescription>
            </UI.CardHeader>
            <UI.CardContent>
              <UI.Input type="password" placeholder="New password" aria-label="New password" />
            </UI.CardContent>
            <UI.CardFooter>
              <UI.Button data-demo-toast="Password updated (demo)">
                Update password
              </UI.Button>
            </UI.CardFooter>
          </UI.Card>
        </UI.TabsContent>
      </UI.Tabs>
    ),
  },
  {
    id: "menubar",
    title: "Menubar",
    group: "Navigation",
    primitive: "popover + role=menubar",
    description: "The familiar desktop menu, at home on the web.",
    code:
      "<Menubar>\n  <MenubarMenu>\n    <MenubarTrigger for=\"file-menu\">File</MenubarTrigger>\n    <DropdownMenu id=\"file-menu\">\n      <DropdownMenuItem>New file</DropdownMenuItem>\n    </DropdownMenu>\n  </MenubarMenu>\n</Menubar>",
    preview: (
      <UI.Menubar>
        <UI.MenubarMenu>
          <UI.MenubarTrigger for="file-menu" style="anchor-name: --file-menu">
            File
          </UI.MenubarTrigger>
          <UI.DropdownMenu id="file-menu">
            <UI.DropdownMenuItem data-demo-toast="New file created">
              New file<UI.DropdownMenuShortcut>
                ⌘N
              </UI.DropdownMenuShortcut>
            </UI.DropdownMenuItem>
            <UI.DropdownMenuItem data-demo-toast="Export selected">
              Export…
            </UI.DropdownMenuItem>
          </UI.DropdownMenu>
        </UI.MenubarMenu>
        <UI.MenubarMenu>
          <UI.MenubarTrigger for="edit-menu" style="anchor-name: --edit-menu">
            Edit
          </UI.MenubarTrigger>
          <UI.DropdownMenu id="edit-menu">
            <UI.DropdownMenuItem data-demo-toast="Undo selected">
              Undo
            </UI.DropdownMenuItem>
            <UI.DropdownMenuItem data-demo-toast="Redo selected">
              Redo
            </UI.DropdownMenuItem>
          </UI.DropdownMenu>
        </UI.MenubarMenu>
        <UI.MenubarMenu>
          <UI.MenubarTrigger for="view-menu" style="anchor-name: --view-menu">
            View
          </UI.MenubarTrigger>
          <UI.DropdownMenu id="view-menu">
            <UI.DropdownMenuCheckboxItem checked>
              Show grid
            </UI.DropdownMenuCheckboxItem>
          </UI.DropdownMenu>
        </UI.MenubarMenu>
      </UI.Menubar>
    ),
  },
  {
    id: "accordion",
    title: "Accordion",
    group: "Layout",
    primitive: "details + summary",
    description: "Progressive disclosure, powered by native details elements.",
    code:
      "<Accordion>\n  <AccordionItem name=\"faq\">\n    <AccordionTrigger>Is it accessible?</AccordionTrigger>\n    <AccordionContent>Native HTML handles keyboard interaction.</AccordionContent>\n  </AccordionItem>\n</Accordion>",
    preview: (
      <UI.Accordion class="w-full max-w-md rounded-lg bg-background px-4">
        <UI.AccordionItem name="faq-demo">
          <UI.AccordionTrigger>
            Is it accessible?
          </UI.AccordionTrigger>
          <UI.AccordionContent>
            Native HTML provides keyboard interaction and built-in semantics. Add clear labels to your controls.
          </UI.AccordionContent>
        </UI.AccordionItem>
        <UI.AccordionItem name="faq-demo">
          <UI.AccordionTrigger>
            Does it need a framework?
          </UI.AccordionTrigger>
          <UI.AccordionContent>
            No client framework. Render HTML with effect-start and let the browser handle the basics.
          </UI.AccordionContent>
        </UI.AccordionItem>
        <UI.AccordionItem name="faq-demo">
          <UI.AccordionTrigger>
            Can I make it my own?
          </UI.AccordionTrigger>
          <UI.AccordionContent>
            Absolutely. Pass Tailwind classes and adjust the CSS theme tokens.
          </UI.AccordionContent>
        </UI.AccordionItem>
      </UI.Accordion>
    ),
  },
  {
    id: "collapsible",
    title: "Collapsible",
    group: "Layout",
    primitive: "details + summary",
    description: "Show a little now. Reveal the rest when it's needed.",
    code:
      "<details>\n  <summary class=\"cursor-pointer\">3 starred repositories</summary>\n  <div>effect-start, effect, bun</div>\n</details>",
    preview: (
      <details class="w-full max-w-sm rounded-lg border bg-background">
        <summary class="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          3 starred repositories <Icon name="chevron" class="size-4 rotate-90" />
        </summary>
        <div class="grid gap-2 border-t p-4">
          <code class="rounded-md border p-2 text-xs">
            nounder/effect-start
          </code>
          <code class="rounded-md border p-2 text-xs">
            Effect-TS/effect
          </code>
          <code class="rounded-md border p-2 text-xs">
            oven-sh/bun
          </code>
        </div>
      </details>
    ),
  },
  {
    id: "resizable",
    title: "Resizable",
    group: "Layout",
    primitive: "pointer + keyboard events",
    description: "Find the right balance. Drag the handle or use the arrow keys.",
    code:
      "<ResizablePanelGroup>\n  <ResizablePanel defaultSize={40} minSize={20}>Sidebar</ResizablePanel>\n  <ResizableHandle withHandle />\n  <ResizablePanel defaultSize={60} minSize={20}>Content</ResizablePanel>\n</ResizablePanelGroup>",
    preview: (
      <UI.ResizablePanelGroup class="h-44 w-full rounded-lg border bg-background">
        <UI.ResizablePanel defaultSize={40} minSize={20}>
          <div class="grid h-full place-items-center text-sm font-medium">
            Sidebar
          </div>
        </UI.ResizablePanel>
        <UI.ResizableHandle withHandle aria-label="Resize panels" />
        <UI.ResizablePanel defaultSize={60} minSize={20}>
          <div class="grid h-full place-items-center text-sm text-muted-foreground">
            Main content
          </div>
        </UI.ResizablePanel>
      </UI.ResizablePanelGroup>
    ),
  },
  {
    id: "carousel",
    title: "Carousel",
    group: "Layout",
    primitive: "CSS scroll-snap",
    description: "Swipeable content with native scroll snapping and keyboard controls.",
    code:
      "<Carousel items={[<div>One</div>, <div>Two</div>]} />",
    preview: (
      <UI.Carousel
        class="mx-10 w-full max-w-xs"
        aria-label="Carousel example"
        items={[1, 2, 3, 4, 5].map((n) => (
          <div class="grid h-40 place-items-center rounded-lg border bg-background">
            <span class="text-4xl font-semibold tracking-tight">
              {n.toString().padStart(2, "0")}
            </span>
          </div>
        ))}
      />
    ),
  },
  {
    id: "item",
    title: "Item",
    group: "Data display",
    primitive: "div",
    description: "A flexible row for lists, files, and everything in between.",
    code:
      "<ItemGroup>\n  <Item variant=\"outline\">\n    <ItemMedia variant=\"icon\">…</ItemMedia>\n    <ItemContent>\n      <ItemTitle>Project proposal</ItemTitle>\n      <ItemDescription>Updated just now</ItemDescription>\n    </ItemContent>\n    <ItemActions><Button variant=\"ghost\">Open</Button></ItemActions>\n  </Item>\n</ItemGroup>",
    preview: (
      <UI.ItemGroup class="w-full max-w-md rounded-lg border bg-background">
        <UI.Item>
          <UI.ItemHeader>
            <span class="text-xs text-muted-foreground">
              RECENT FILES
            </span>
            <UI.Badge variant="secondary">
              2 files
            </UI.Badge>
          </UI.ItemHeader>
          <UI.ItemMedia variant="icon">
            <Icon name="folder" />
          </UI.ItemMedia>
          <UI.ItemContent>
            <UI.ItemTitle>
              Project proposal
            </UI.ItemTitle>
            <UI.ItemDescription>
              Updated just now · 24 KB
            </UI.ItemDescription>
          </UI.ItemContent>
          <UI.ItemActions>
            <UI.Button variant="ghost" size="icon-sm" aria-label="Open proposal" data-demo-toast="Proposal selected">
              <Icon name="arrow" />
            </UI.Button>
          </UI.ItemActions>
          <UI.ItemFooter>
            <span class="text-xs text-muted-foreground">
              Shared with your team
            </span>
          </UI.ItemFooter>
        </UI.Item>
        <UI.ItemSeparator />
        <UI.Item>
          <UI.ItemMedia variant="icon">
            <Icon name="code" />
          </UI.ItemMedia>
          <UI.ItemContent>
            <UI.ItemTitle>
              Design tokens
            </UI.ItemTitle>
            <UI.ItemDescription>
              Updated 2 hours ago · 8 KB
            </UI.ItemDescription>
          </UI.ItemContent>
          <UI.ItemActions>
            <UI.Button variant="ghost" size="icon-sm" aria-label="Open tokens" data-demo-toast="Design tokens selected">
              <Icon name="arrow" />
            </UI.Button>
          </UI.ItemActions>
        </UI.Item>
      </UI.ItemGroup>
    ),
  },
  {
    id: "table",
    title: "Table",
    group: "Data display",
    primitive: "table",
    description: "Readable data, with real table semantics.",
    code:
      "<Table>\n  <TableCaption>Recent invoices</TableCaption>\n  <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>\n  <TableBody><TableRow><TableCell>INV-001</TableCell><TableCell>$250.00</TableCell></TableRow></TableBody>\n</Table>",
    preview: (
      <div class="w-full rounded-lg border bg-background p-3">
        <UI.Table>
          <UI.TableCaption>
            A list of your recent invoices.
          </UI.TableCaption>
          <UI.TableHeader>
            <UI.TableRow>
              <UI.TableHead scope="col">
                Invoice
              </UI.TableHead>
              <UI.TableHead scope="col">
                Status
              </UI.TableHead>
              <UI.TableHead scope="col" class="text-right">
                Amount
              </UI.TableHead>
            </UI.TableRow>
          </UI.TableHeader>
          <UI.TableBody>
            {[{ id: "INV-001", status: "Paid", amount: "$250.00" }, {
              id: "INV-002",
              status: "Pending",
              amount: "$150.00",
            }, { id: "INV-003", status: "Paid", amount: "$350.00" }]
              .map((invoice) => (
                <UI.TableRow>
                  <UI.TableCell class="font-medium">
                    {invoice.id}
                  </UI.TableCell>
                  <UI.TableCell>
                    <UI.Badge variant={invoice.status === "Paid" ? "secondary" : "outline"}>
                      {invoice.status}
                    </UI.Badge>
                  </UI.TableCell>
                  <UI.TableCell class="text-right font-mono text-xs">
                    {invoice.amount}
                  </UI.TableCell>
                </UI.TableRow>
              ))}
          </UI.TableBody>
          <UI.TableFooter>
            <UI.TableRow>
              <UI.TableCell colspan={2}>
                Total
              </UI.TableCell>
              <UI.TableCell class="text-right font-mono text-xs">
                $750.00
              </UI.TableCell>
            </UI.TableRow>
          </UI.TableFooter>
        </UI.Table>
      </div>
    ),
  },
  {
    id: "empty",
    title: "Empty",
    group: "Data display",
    primitive: "div",
    description: "Make an empty state feel like a fresh start.",
    code:
      "<Empty>\n  <EmptyHeader>\n    <EmptyMedia variant=\"icon\">…</EmptyMedia>\n    <EmptyTitle>No projects yet</EmptyTitle>\n    <EmptyDescription>Your next idea starts here.</EmptyDescription>\n  </EmptyHeader>\n  <EmptyContent><Button>Create project</Button></EmptyContent>\n</Empty>",
    preview: (
      <UI.Empty class="w-full border bg-background">
        <UI.EmptyHeader>
          <UI.EmptyMedia variant="icon">
            <Icon name="folder" />
          </UI.EmptyMedia>
          <UI.EmptyTitle>
            No projects yet
          </UI.EmptyTitle>
          <UI.EmptyDescription>
            Your next idea starts here. Create a project to get going.
          </UI.EmptyDescription>
        </UI.EmptyHeader>
        <UI.EmptyContent>
          <UI.Button data-demo-toast="Project created">
            <Icon name="plus" /> Create project
          </UI.Button>
          <a href="#card" class={UI.buttonClassName({ variant: "link", size: "sm" })}>
            Explore a card example <Icon name="arrow" />
          </a>
        </UI.EmptyContent>
      </UI.Empty>
    ),
  },
  {
    id: "alert",
    title: "Alert",
    group: "Feedback",
    primitive: "role=alert",
    description: "The right message, with the right amount of emphasis.",
    code:
      "<Alert>\n  <AlertTitle>You're all set</AlertTitle>\n  <AlertDescription>Your changes have been saved.</AlertDescription>\n</Alert>",
    preview: (
      <div class="grid w-full max-w-md gap-4">
        <UI.Alert class="bg-background">
          <Icon name="check" />
          <UI.AlertTitle>
            You're all set
          </UI.AlertTitle>
          <UI.AlertDescription>
            Your changes have been saved. Time to build something.
          </UI.AlertDescription>
        </UI.Alert>
        <UI.Alert variant="destructive" class="bg-background">
          <Icon name="info" />
          <UI.AlertTitle>
            Something needs your attention
          </UI.AlertTitle>
          <UI.AlertDescription>
            Please check your email address and try again.
          </UI.AlertDescription>
        </UI.Alert>
      </div>
    ),
  },
  {
    id: "progress",
    title: "Progress",
    group: "Feedback",
    primitive: "role=progressbar",
    description: "Show how far you've come, and how much is left.",
    code: "<Progress value={65} aria-label=\"Upload progress\" />",
    preview: (
      <div class="w-full max-w-sm space-y-3">
        <div class="flex justify-between text-sm">
          <span>
            Uploading files
          </span>
          <span class="font-mono text-xs text-muted-foreground">
            65%
          </span>
        </div>
        <UI.Progress value={65} aria-label="Upload progress" />
        <p class="text-xs text-muted-foreground">
          13 of 20 files uploaded
        </p>
      </div>
    ),
  },
  {
    id: "spinner",
    title: "Spinner",
    group: "Feedback",
    primitive: "SVG + CSS animation",
    description: "A small sign that something good is on its way.",
    code: "<Button disabled><Spinner /> Please wait</Button>",
    preview: (
      <div class="flex items-center gap-6">
        <UI.Spinner class="size-6" role="status" aria-label="Loading" />
        <UI.Button disabled>
          <UI.Spinner /> Please wait
        </UI.Button>
      </div>
    ),
  },
  {
    id: "toast",
    title: "Toast",
    group: "Feedback",
    primitive: "live region",
    description: "A lightweight notification that gets out of the way.",
    code: "<Toast title=\"Changes saved\" description=\"You're good to go.\" variant=\"success\" />",
    preview: (
      <>
        <UI.Button variant="outline" data-show-toast>
          Show toast
        </UI.Button>
        <template id="toast-template">
          <UI.Toast
            title="Changes saved"
            description="You're good to go. Keep making great things."
            variant="success"
          />
        </template>
      </>
    ),
  },
]

export default Route.get(Route.schemaSearchParams({ page: Schema.optional(Schema.FiniteFromString) }), Route.html(function*(ctx) {
  const gallery = createGallery(Math.max(1, Math.min(10, Math.trunc(ctx.searchParams.page ?? 1))))
  const groups = Array.from(new Set(gallery.map((component) => component.group)))
  return (
    <>
      <a
        href="#overview"
        class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div
        id="top"
        class="mx-auto grid max-w-[1440px] lg:grid-cols-[200px_minmax(0,1fr)]"
      >
        <aside
          class="docs-sidebar sticky top-0 hidden h-dvh overflow-y-auto overscroll-contain border-r px-4 pb-8 pt-6 lg:block"
          aria-label="Documentation sidebar"
        >
          <a href="#overview" class="mb-5 block px-2 text-lg font-semibold tracking-tight">
            effect/ui
          </a>
          <div class="mb-6 flex items-center gap-2">
            <Button
              variant="outline"
              class="min-w-0 flex-1 justify-start text-muted-foreground"
              commandfor="component-search"
              command="show-modal"
              aria-label="Search components"
            >
              <Icon name="search" /> Search
              <Kbd class="ml-auto">
                ⌘K
              </Kbd>
            </Button>
          </div>
          <div class="mb-7">
            <p class="mb-2 px-2 text-xs font-semibold">
              Getting started
            </p>
            <a href="#overview" class="docs-link block rounded-md px-2 py-1.5 text-[13px]">
              Introduction
            </a>
            <a href="#installation" class="docs-link block rounded-md px-2 py-1.5 text-[13px]">
              Installation
            </a>
          </div>
          {groups.map((group) => (
            <div class="mb-6">
              <p class="mb-2 px-2 text-xs font-semibold">
                {group}
              </p>
              {gallery.filter((component) => component.group === group).map((component) => (
                <a
                  href={`#${component.id}`}
                  data-nav-link={component.id}
                  class="docs-link flex items-center justify-between rounded-md px-2 py-1.5 text-[13px]"
                >
                  {component.title}
                </a>
              ))}
            </div>
          ))}
        </aside>
        <main id="overview" class="min-w-0 px-5 pb-16 pt-6 sm:px-8 lg:px-10 lg:pt-8">
          <div class="mb-6 flex items-center gap-2 lg:hidden">
            <Button variant="outline" commandfor="mobile-navigation" command="show-modal" aria-label="Open navigation">
              <Icon name="menu" /> Components
            </Button>
            <Button
              variant="outline"
              size="icon"
              commandfor="component-search"
              command="show-modal"
              aria-label="Search components"
            >
              <Icon name="search" />
            </Button>
          </div>
          <div class="flex items-center justify-between gap-3">
            <h1 class="text-3xl font-semibold tracking-tight">
              Components
            </h1>
            <div class="flex items-center gap-3">
              <Button variant="outline" size="sm" data-test-all>
                Test all
              </Button>
              <a href="#test-results" data-test-all-link hidden aria-live="polite" class="text-xs underline">
                Results
              </a>
            </div>
          </div>
          <p class="mt-3 text-sm leading-6 text-muted-foreground">
            Native HTML components styled with Tailwind. Browse the previews and copy the code.
          </p>
          <div id="test-results" data-test-all-result hidden="until-found">
            <div class="component-test-result mt-3 rounded-md border px-3 py-2 text-xs">
              <p data-test-all-summary class="font-medium">
                Test results
              </p>
              <ul data-test-all-list class="mt-2 space-y-1.5" />
            </div>
          </div>
          <section id="installation" class="mt-8 rounded-lg border bg-muted/30 p-5">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-medium">
                Make it yours
              </h2>
              <span class="font-mono text-[10px] text-muted-foreground">
                ui.tsx
              </span>
            </div>
            <p class="mt-2 text-[13px] leading-6 text-muted-foreground">
              All components live in a single module. Import what you need, then compose with HTML and Tailwind classes.
              This example's CSS supplies the theme tokens and native overlay styles.
            </p>
            <pre class="mt-4 overflow-x-auto rounded-md border bg-background px-4 py-3 text-xs leading-6"><code>{'import { Button, Dialog, Popover, Slider } from "./ui.tsx"'}</code></pre>
          </section>
          <div class="mt-10 space-y-12">
            {gallery.map((component) => (
              <section id={component.id} data-doc-section aria-labelledby={`${component.id}-heading`}>
                <div class="flex items-center justify-between gap-3">
                  <h2
                    id={`${component.id}-heading`}
                    class="flex items-center gap-3 text-xl font-semibold tracking-tight"
                  >
                    <a href={`#${component.id}`} class="hover:underline">
                      {component
                        .title}
                    </a>
                  </h2>
                  <div class="flex items-center gap-3">
                    <a
                      href={`#test-result-${component.id}`}
                      data-test-link
                      hidden
                      aria-live="polite"
                      class="text-xs underline"
                    >
                      Results
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      data-test-individual
                      aria-label={`Test ${component.title}`}
                    >
                      Test
                    </Button>
                  </div>
                </div>
                <p class="mt-2 text-sm leading-6 text-muted-foreground">
                  {component
                    .description}
                </p>
                <details
                  id={`test-result-${component.id}`}
                  data-test-result
                  hidden="until-found"
                  class="component-test-result mt-3 rounded-md border px-3 py-2 text-xs"
                >
                  <summary aria-live="polite" class="cursor-pointer font-medium">
                    Test results
                  </summary>
                  <ul class="mt-2 space-y-1.5 break-words" />
                </details>
                <Tabs name={`preview-${component.id}`} class="mt-4 gap-0">
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <TabsList variant="line">
                      <TabsTrigger name={`preview-${component.id}`} value="preview" checked>
                        Preview
                      </TabsTrigger>
                      <TabsTrigger name={`preview-${component.id}`} value="code">
                        <Icon name="code" class="size-3" /> Code
                      </TabsTrigger>
                    </TabsList>
                    <code class="max-w-[50%] truncate text-[10px] text-muted-foreground">
                      {component
                        .primitive}
                    </code>
                  </div>
                  <TabsContent name={`preview-${component.id}`} value="preview">
                    <div class="preview-surface flex min-h-48 items-center justify-center rounded-lg border px-5 py-9 sm:px-8">
                      {component
                        .preview}
                    </div>
                  </TabsContent>
                  <TabsContent name={`preview-${component.id}`} value="code">
                    <div class="relative rounded-lg border bg-muted/40">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="absolute top-3 right-3"
                        aria-label={`Copy ${component.title} code`}
                        data-copy-code={component
                          .id}
                      >
                        <Icon name="copy" />
                      </Button>
                      <pre class="max-h-96 overflow-auto p-6 pr-12 text-xs leading-6"><code id={`code-${component.id}`}>{component.code}</code></pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </section>
            ))}
          </div>
        </main>
      </div>
      <Dialog aria-label="Search components" id="component-search" class="p-0 overflow-hidden">
        <DialogHeader class="sr-only">
          <DialogTitle>
            Search components
          </DialogTitle>
        </DialogHeader>
        <div class="flex items-center gap-3 border-b px-4 py-2">
          <Icon name="search" class="size-5 text-muted-foreground" />
          <Input
            id="component-search-input"
            type="search"
            autofocus
            placeholder="Find a component…"
            aria-label="Find a component"
            class="h-11 border-0 shadow-none focus-visible:ring-0"
          />
          <Kbd>
            esc
          </Kbd>
        </div>
        <div id="search-results" class="max-h-80 overflow-y-auto px-2 pb-2" aria-label="Component results">
          {gallery.map((component) => (
            <a
              href={`#${component.id}`}
              data-search-result
              data-search-text={`${component.title} ${component.group} ${component.primitive}`}
              class="flex items-center justify-between rounded-md px-3 py-2.5 text-sm hover:bg-muted focus:bg-muted"
            >
              <span class="flex items-center gap-3">
                <Icon name="code" class="size-4 text-muted-foreground" />
                {component.title}
              </span>
              <span class="text-[10px] text-muted-foreground">
                {component.group}
              </span>
            </a>
          ))}
          <p id="search-empty" hidden class="p-6 text-center text-sm text-muted-foreground">
            No components found. Try another search.
          </p>
        </div>
      </Dialog>
      <dialog
        id="mobile-navigation"
        closedby="any"
        class="fixed inset-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] border-r bg-background p-5"
      >
        <h2 class="mb-5 text-lg font-semibold">
          Components
        </h2>
        <DialogClose for="mobile-navigation" />
        <nav
          class="docs-sidebar h-[calc(100%-3rem)] overflow-auto overscroll-contain"
          aria-label="Mobile component navigation"
        >
          {groups.map((group) => (
            <div class="mb-5">
              <p class="mb-2 text-xs font-medium text-muted-foreground">
                {group}
              </p>
              {gallery.filter((component) => component.group === group).map((component) => (
                <a href={`#${component.id}`} data-mobile-link class="block rounded-md px-2 py-2 text-sm hover:bg-muted">
                  {component
                    .title}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </dialog>
      <div
        id="demo-notifications"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="pointer-events-none fixed right-5 bottom-5 z-[100] max-w-[calc(100vw-2.5rem)]"
      />
      <script>
        {() => {
          const search = document.querySelector<HTMLDialogElement>("#component-search")!
          const searchInput = document.querySelector<HTMLInputElement>("#component-search-input")!
          const results = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-search-result]"))
          const mobileNav = document.querySelector<HTMLDialogElement>("#mobile-navigation")!
          const notifications = document.querySelector<HTMLElement>("#demo-notifications")!
          let notificationTimer: ReturnType<typeof setTimeout>

          function notify(message: string) {
            clearTimeout(notificationTimer)
            notifications.textContent = message
            notifications.className =
              "fixed right-5 bottom-5 z-[100] max-w-[calc(100vw-2.5rem)] rounded-lg border bg-popover px-5 py-4 text-sm text-popover-foreground shadow-lg"
            notificationTimer = setTimeout(() => {
              notifications.textContent = ""
              notifications.className = "hidden"
            }, 3500)
          }

          document.addEventListener("click", async (event) => {
            const target = event.target instanceof Element ? event.target.closest<HTMLElement>("button, a") : null
            if (!target) return
            if (
              target.hasAttribute("commandfor") && !("commandForElement" in HTMLButtonElement.prototype) && !target
                .hasAttribute("onclick")
            ) {
              const dialog = document.getElementById(target.getAttribute("commandfor")!)
              if (dialog instanceof HTMLDialogElement) {
                if (target.getAttribute("command") === "close") dialog.close()
                else if (!dialog.open) dialog.showModal()
              }
            }
            if (target.hasAttribute("data-search-result")) search.close()
            if (target.hasAttribute("data-mobile-link")) mobileNav.close()
            if (target.dataset.copyCode) {
              try {
                await navigator.clipboard.writeText(document.getElementById(`code-${target.dataset.copyCode}`)!.textContent!)
                notify("Code copied to clipboard")
              } catch {
                notify("Select the code and copy it with your keyboard.")
              }
            }
            if (target.dataset.demoToast) {
              notify(target.dataset.demoToast)
              target.closest<HTMLElement>("[popover]")?.hidePopover()
            }
            if (target.hasAttribute("data-show-toast")) {
              const template = document.querySelector<HTMLTemplateElement>("#toast-template")!
              const fragment = template.content.cloneNode(true) as DocumentFragment
              const script = fragment.querySelector("script")!
              const activeScript = document.createElement("script")
              activeScript.textContent = script.textContent
              script.replaceWith(activeScript)
              document.body.appendChild(fragment)
            }
          })

          document.addEventListener("keydown", (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
              event.preventDefault()
              if (search.open) search.close()
              else search.showModal()
            }
            if (search.open && event.key === "ArrowDown" && document.activeElement === searchInput) {
              event.preventDefault()
              results.find((result) => !result.hidden)?.focus()
            }
          })

          searchInput.addEventListener("input", () => {
            const query = searchInput.value.toLowerCase().trim()
            let matches = 0
            for (const result of results) {
              result.hidden = !result.dataset.searchText!.toLowerCase().includes(query)
              if (!result.hidden) matches++
            }
            document.getElementById("search-empty")!.hidden = matches > 0
          })

          document.addEventListener("input", (event) => {
            if (event.target instanceof HTMLInputElement && event.target.dataset.output) {
              document.getElementById(event.target.dataset.output)!.textContent = `${event.target.value}%`
            }
          })

          document.querySelectorAll("[data-demo-form]").forEach((form) =>
            form.addEventListener("submit", (event) => {
              event.preventDefault()
              notify("Profile saved")
            })
          )

          const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue
              document.querySelectorAll<HTMLElement>("[data-nav-link]").forEach((link) => {
                if (link.dataset.navLink === entry.target.id) link.setAttribute("aria-current", "true")
                else link.removeAttribute("aria-current")
              })
            }
          }, { rootMargin: "-15% 0px -60% 0px" })
          document.querySelectorAll("[data-doc-section]").forEach((section) => observer.observe(section))
        }}
      </script>
      <script>
        {() => {
          type Check = { name: string; passed: boolean; detail?: string }
          type Result = {
            id: string
            checks: Check[]
            duration: number
          }
          type Context = {
            root: HTMLElement
            result: Result
            check: (name: string, passed: boolean, detail?: string) => void
          }

          function element<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
            const found = root.querySelector<T>(selector)
            if (!found) throw new Error(`Missing element: ${selector}`)
            return found
          }

          function visible(node: Element) {
            const rect = node.getBoundingClientRect()
            const style = getComputedStyle(node)
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none"
          }

          function popoverOpen(node: Element) {
            return CSS.supports("selector(:popover-open)") && node.matches(":popover-open")
          }

          function focus(node: HTMLElement) {
            node.focus({ preventScroll: true })
            // Inactive windows update activeElement without emitting focus and blur events.
            if (!document.hasFocus()) node.dispatchEvent(new FocusEvent("focus"))
          }

          function blur(node: HTMLElement) {
            node.blur()
            if (!document.hasFocus()) node.dispatchEvent(new FocusEvent("blur"))
          }

          async function until(predicate: () => boolean, milliseconds = 2000) {
            const deadline = performance.now() + milliseconds
            while (!predicate() && performance.now() < deadline) {
              await new Promise<void>((resolve) => setTimeout(resolve, 16))
            }
            return predicate()
          }

          function afterLayout() {
            return new Promise<void>((resolve) => {
              const timeout = setTimeout(resolve, 50)
              requestAnimationFrame(() => {
                clearTimeout(timeout)
                resolve()
              })
            })
          }

          function key(node: Element, value: string) {
            node.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }))
          }

          function saveState(root: HTMLElement) {
            const nodes = [root, ...root.querySelectorAll<HTMLElement>("*")]
            const snapshots = nodes.map((node) => ({
              node,
              attributes: Array.from(node.attributes, (attribute) => [attribute.name, attribute.value] as const),
              value: node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement
                ? node.value
                : undefined,
              checked: node instanceof HTMLInputElement ? node.checked : undefined,
              text: node instanceof HTMLOutputElement ? node.textContent : undefined,
              scrollLeft: node.scrollLeft,
              scrollTop: node.scrollTop,
            }))
            return () => {
              for (const snapshot of snapshots) {
                for (const attribute of Array.from(snapshot.node.attributes)) {
                  if (!snapshot.attributes.some((original) => original[0] === attribute.name)) {
                    snapshot.node.removeAttribute(attribute.name)
                  }
                }
                for (const attribute of snapshot.attributes) {
                  if (snapshot.node.getAttribute(attribute[0]) !== attribute[1]) {
                    snapshot.node.setAttribute(attribute[0], attribute[1])
                  }
                }
                if (snapshot.node instanceof HTMLInputElement) snapshot.node.checked = snapshot.checked!
                if (
                  snapshot.node instanceof HTMLInputElement ||
                  snapshot.node instanceof HTMLTextAreaElement
                  || snapshot.node instanceof HTMLSelectElement
                ) snapshot.node.value = snapshot.value!
                if (snapshot.node instanceof HTMLOutputElement) snapshot.node.textContent = snapshot.text!
                if (snapshot.node instanceof HTMLElement) {
                  snapshot.node.scrollTo({ left: snapshot.scrollLeft, top: snapshot.scrollTop, behavior: "instant" })
                }
              }
            }
          }

          function resetFixture(root: HTMLElement) {
            for (const input of root.querySelectorAll<HTMLInputElement>("input")) {
              input.value = input.defaultValue
              input.checked = input.defaultChecked
              input.dispatchEvent(new Event("change", { bubbles: true }))
              input.dispatchEvent(new Event("input", { bubbles: true }))
            }
            for (const textarea of root.querySelectorAll<HTMLTextAreaElement>("textarea")) textarea.value = textarea.defaultValue
            for (const select of root.querySelectorAll<HTMLSelectElement>("select")) {
              select.selectedIndex = Math.max(0, Array.from(select.options).findIndex((option) => option.defaultSelected))
            }
            for (const details of root.querySelectorAll<HTMLDetailsElement>("details")) details.open = false
            for (
              const scroll of root.querySelectorAll<HTMLElement>("[data-slot=Carousel_contentTrack]")
            ) {
              scroll.scrollTo({ top: 0, left: 0, behavior: "instant" })
            }
          }

          function controls(context: Context) {
            const root = context.root
            for (
              const input of root.querySelectorAll<HTMLInputElement>("input:not([data-tabs-name]):not([data-slot=Command_input])")
            ) {
              if (!visible(input) && !input.closest("label")) continue
              if (input.disabled) {
                const checked = input.checked
                input.click()
                context.check("Disabled control ignores activation", input.checked === checked)
                continue
              }
              if (input.type === "checkbox" || input.type === "radio") {
                const before = input.checked
                input.click()
                context.check(
                  `${input.getAttribute("aria-label") ?? input.id ?? input.type} changes selection`,
                  input.type === "checkbox" ? input.checked !== before : input.checked,
                )
                if (input.type === "checkbox" && before) context.check("Checked checkbox toggles off", !input.checked)
                if (input.type === "radio" && input.name) {
                  context.check(
                    "Radio group has exactly one selection",
                    Array
                      .from(root.querySelectorAll<HTMLInputElement>("input"))
                      .filter((other) => other.type === "radio" && other.name === input.name && other.checked)
                      .length === 1,
                  )
                }
              } else {
                input.focus({ preventScroll: true })
                context.check("Enabled input receives focus", document.activeElement === input)
                const next = input.type === "range" ? "72" : input.type === "email" ? "test@example.com" : "Browser test"
                input.value = next
                input.dispatchEvent(new Event("input", { bubbles: true }))
                input.dispatchEvent(new Event("change", { bubbles: true }))
                context.check("Input retains edited value", input.value === next)
                if (input.dataset.output) {
                  context.check(
                    "Range output follows value",
                    document.getElementById(input.dataset.output)?.textContent === `${next}%`,
                  )
                }
                if (input.list) context.check("Combobox has suggestions", input.list.options.length > 0)
              }
            }
            for (const textarea of root.querySelectorAll<HTMLTextAreaElement>("textarea")) {
              if (!visible(textarea) || textarea.disabled) continue
              textarea.focus({ preventScroll: true })
              textarea.value = "Browser test\nSecond line"
              textarea.dispatchEvent(new Event("input", { bubbles: true }))
              context.check(
                "Textarea accepts multiple lines and focus",
                textarea.value.includes("\n") && document.activeElement === textarea,
              )
            }
            for (const select of root.querySelectorAll<HTMLSelectElement>("select")) {
              const option = Array.from(select.options).find((option) => option.value && !option.disabled)
              if (!option) throw new Error("Select has no selectable options")
              select.value = option.value
              select.dispatchEvent(new Event("change", { bubbles: true }))
              context.check("Select changes option", select.selectedOptions[0] === option)
            }
            for (
              const button of root.querySelectorAll<HTMLButtonElement>("button[data-demo-toast]:not([data-slot=Command_item])")
            ) {
              if (!visible(button)) continue
              button.click()
              context.check(
                "Demo action produces its notification",
                document.getElementById("demo-notifications")?.textContent === button.dataset.demoToast,
              )
            }
          }

          function tabs(context: Context, root: HTMLElement) {
            const triggers = Array
              .from(root.querySelectorAll<HTMLInputElement>("input[data-tabs-name]"))
              .filter((trigger) => trigger.closest("[data-slot=Tabs]") === root)
            context.check("Tabs have at least two choices", triggers.length >= 2)
            for (const trigger of triggers) {
              trigger.click()
              const panels = Array
                .from(root.querySelectorAll<HTMLElement>("[data-slot=Tabs_content]"))
                .filter((panel) => panel.dataset.tabsName === trigger.dataset.tabsName)
              context.check(
                `Only ${trigger.value} panel is visible`,
                panels.length > 0 && panels.every((panel) => panel.hidden === (panel.dataset.tabsValue !== trigger.value)),
              )
            }
          }

          function modal(context: Context) {
            const dialog = element<HTMLDialogElement>(context.root, "dialog")
            const trigger = element<HTMLButtonElement>(context.root, "button[command=show-modal]")
            trigger.focus({ preventScroll: true })
            const scroll = window.scrollY
            trigger.click()
            context.check("Trigger opens a native modal", dialog.open && dialog.matches(":modal"))
            if (!dialog.open) return
            const rect = dialog.getBoundingClientRect()
            context.check("Overlay is fixed to the viewport", getComputedStyle(dialog).position === "fixed")
            context.check(
              "Overlay is visible inside the viewport",
              rect.top >= -1 && rect.left >= -1 && rect.bottom <= innerHeight + 1 && rect.right <= innerWidth + 1,
            )
            context.check("Opening preserves page scroll", Math.abs(window.scrollY - scroll) <= 1)
            context.check("Background scrolling is locked", getComputedStyle(document.documentElement).overflowY === "hidden")
            context.check("Focus moves into the modal", dialog.contains(document.activeElement))
            element<HTMLButtonElement>(document, "[data-test-all]").focus({ preventScroll: true })
            context.check("Background cannot take focus", dialog.contains(document.activeElement))
            const close = element<HTMLButtonElement>(
              dialog,
              context.result.id === "alert-dialog" ? "button[command=close]" : "[data-slot=Dialog_close]",
            )
            context.check("Close control has a visible click target", visible(close))
            context.check(
              "Close control has an accessible label",
              !!(close.getAttribute("aria-label") || close.textContent?.trim()),
            )
            close.click()
            context.check("Close control dismisses the modal", !dialog.open)
            context.check("Closing preserves page scroll", Math.abs(window.scrollY - scroll) <= 1)
            context.check("Focus returns to the trigger", document.activeElement === trigger)
            if (context.result.id === "dialog") {
              trigger.click()
              const form = element<HTMLFormElement>(dialog, "form")
              form.requestSubmit()
              context.check("Dialog form submission dismisses it", !dialog.open)
              trigger.click()
              dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }))
              context.check("Backdrop click dismisses the dialog", !dialog.open)
            }
          }

          function popoverGeometry(context: Context, popover: HTMLElement, trigger: HTMLElement) {
            context.check("Popover uses viewport positioning", getComputedStyle(popover).position === "fixed")
            const bounds = popover.getBoundingClientRect()
            context.check(
              "Popover is inside viewport",
              bounds.left >= -1 && bounds.top >= -1 && bounds.right <= innerWidth + 1 && bounds.bottom <= innerHeight + 1,
            )
            const anchor = trigger.getBoundingClientRect()
            const gap = Math.min(
              Math.abs(bounds.top - anchor.bottom),
              Math.abs(bounds.bottom - anchor.top),
              Math.abs(bounds.left - anchor.right),
              Math.abs(bounds.right - anchor.left),
            )
            context.check("Popover stays near its trigger", gap <= 32, `Nearest edge gap: ${gap.toFixed(1)}px`)
          }

          async function popovers(context: Context) {
            for (const trigger of context.root.querySelectorAll<HTMLButtonElement>("button[popovertarget]")) {
              if (!visible(trigger)) continue
              const popover = element<HTMLElement>(document, `#${CSS.escape(trigger.getAttribute("popovertarget")!)}`)
              trigger.click()
              const opened = await until(() => popoverOpen(popover))
              context.check("Trigger opens its popover", opened)
              if (!opened) continue
              popoverGeometry(context, popover, trigger)
              const items = popover.querySelectorAll<HTMLButtonElement>(
                "[data-slot=DropdownMenu_item],[data-slot=DropdownMenu_checkboxItem],[data-slot=DropdownMenu_radioItem]",
              )
              const directItems = Array.from(items).filter((item) => item.closest("[role=menu]") === popover)
              if (directItems.length > 1) {
                directItems[0]!.focus({ preventScroll: true })
                key(popover, "ArrowDown")
                context.check("Menu ArrowDown advances focus", document.activeElement === directItems[1])
                key(popover, "Home")
                context.check("Menu Home selects first item", document.activeElement === directItems[0])
                key(popover, "End")
                context.check("Menu End selects last item", document.activeElement === directItems[directItems.length - 1])
              }
              for (const checkbox of popover.querySelectorAll<HTMLButtonElement>("[data-slot=DropdownMenu_checkboxItem]")) {
                const checked = checkbox.getAttribute("aria-checked")
                checkbox.click()
                context.check("Menu checkbox updates accessible state", checkbox.getAttribute("aria-checked") !== checked)
                context.check(
                  "Menu checkbox updates visual state",
                  checkbox.dataset.state === (checkbox.getAttribute("aria-checked") === "true" ? "checked" : "unchecked"),
                )
              }
              const radios = Array.from(popover.querySelectorAll<HTMLButtonElement>("[data-slot=DropdownMenu_radioItem]"))
              if (radios.length > 1) {
                radios[1]!.click()
                context.check(
                  "Menu radio selection is exclusive",
                  radios[1]!.getAttribute("aria-checked") === "true" &&
                    radios.filter((radio) => radio.getAttribute("aria-checked") === "true").length === 1,
                )
              }
              for (const subTrigger of popover.querySelectorAll<HTMLButtonElement>("[data-slot=DropdownMenu_subTrigger]")) {
                const sub = element<HTMLElement>(document, `#${CSS.escape(subTrigger.getAttribute("popovertarget")!)}`)
                subTrigger.click()
                context.check("Submenu opens on click", await until(() => popoverOpen(sub)))
                if (popoverOpen(sub)) popoverGeometry(context, sub, subTrigger)
                if (popoverOpen(sub)) sub.hidePopover()
                subTrigger.dispatchEvent(new MouseEvent("mouseenter"))
                context.check("Submenu opens on hover", await until(() => popoverOpen(sub)))
                subTrigger.parentElement!.dispatchEvent(new MouseEvent("mouseleave", { relatedTarget: popover }))
                context.check("Submenu closes when pointer leaves", !popoverOpen(sub))
                subTrigger.focus({ preventScroll: true })
                key(subTrigger, "ArrowRight")
                context.check("ArrowRight opens and focuses submenu", popoverOpen(sub) && sub.contains(document.activeElement))
                key(sub, "End")
                const subItems = sub.querySelectorAll<HTMLButtonElement>("[role=menuitem]")
                context.check(
                  "Submenu keyboard navigation stays inside submenu",
                  document.activeElement === subItems[subItems.length - 1],
                )
                key(sub, "ArrowLeft")
                context.check(
                  "ArrowLeft closes submenu and returns focus",
                  !popoverOpen(sub) && document.activeElement === subTrigger,
                )
                key(subTrigger, "ArrowRight")
                subItems[0]!.click()
                context.check("Submenu action closes both menus", !popoverOpen(sub) && !popoverOpen(popover))
                trigger.click()
                await until(() => popoverOpen(popover))
              }
              if (popoverOpen(popover)) popover.hidePopover()
              context.check("Popover closes", !popoverOpen(popover))
            }
          }

          const scenarios: Record<string, (context: Context) => void | Promise<void>> = {
            command: async (context) => {
              const input = element<HTMLInputElement>(context.root, "[data-slot=Command_input]")
              const originalQuery = input.value
              const originalActive = input.getAttribute("aria-activedescendant")
              const search = async (query: string) => {
                input.value = query
                input.dispatchEvent(new Event("input", { bubbles: true }))
                const updated = await until(() =>
                  context.root.querySelector<HTMLElement>("[data-slot=Command_list]")?.dataset.query === query
                )
                context.check(`Server returned results for ${JSON.stringify(query)}`, updated)
              }
              try {
                await search("")
                context.check(
                  "Initially renders 100 actions",
                  context.root.querySelectorAll("[data-slot=Command_item]").length === 100,
                )
                element<HTMLElement>(context.root, "#command-demo-projects-open").click()
                focus(input)
                key(input, "ArrowDown")
                const selected = input.getAttribute("aria-activedescendant")
                context.check("Arrows move selection", selected === "command-demo-projects-create")
                await search("projects")
                context.check(
                  "Server filters the results",
                  context.root.querySelectorAll("[data-slot=Command_item]").length === 10,
                )
                context.check("Morph preserves active ID", input.getAttribute("aria-activedescendant") === selected)
                context.check("Morph preserves input focus", document.activeElement === input)
                key(input, "Enter")
                context.check(
                  "Morphed items activate",
                  document.getElementById("demo-notifications")?.textContent === "Create projects selected",
                )
                for (const query of ["s", "se", "set", "sett", "settings"]) {
                  input.value = query
                  input.dispatchEvent(new Event("input", { bubbles: true }))
                }
                context.check(
                  "Throttle delivers the final query",
                  await until(() =>
                    context.root.querySelector<HTMLElement>("[data-slot=Command_list]")?.dataset.query === "settings"
                  ),
                )
                context.check(
                  "Missing active item falls back by position",
                  input.getAttribute("aria-activedescendant") === "command-demo-settings-create",
                )
                await search("no-such-action")
                context.check(
                  "No matches leave the list empty",
                  element(context.root, "[data-slot=Command_list]").children.length === 0,
                )
                context.check("Empty results clear selection", !input.hasAttribute("aria-activedescendant"))
                await search("")
                context.check(
                  "Clearing the query restores 100 actions",
                  context.root.querySelectorAll("[data-slot=Command_item]").length === 100,
                )
              } finally {
                await search(originalQuery)
                if (originalActive) document.getElementById(originalActive)?.click()
              }
            },
            button: (context) => {
              const buttons = context.root.querySelectorAll<HTMLButtonElement>("button")
              context.check("All six button variants render", buttons.length >= 8)
              const disabled = element<HTMLButtonElement>(context.root, "button:disabled")
              let clicks = 0
              const count = () => clicks++
              disabled.addEventListener("click", count)
              disabled.click()
              disabled.removeEventListener("click", count)
              context.check("Disabled button suppresses clicks", clicks === 0)
              const enabled = element<HTMLButtonElement>(context.root, "button:not(:disabled)")
              enabled.focus({ preventScroll: true })
              context.check("Enabled button receives focus", document.activeElement === enabled)
            },
            "input-group": (context) => {
              for (const control of context.root.querySelectorAll<HTMLElement>("[data-slot=InputGroup_control]")) {
                control.focus({ preventScroll: true })
                const style = getComputedStyle(control)
                context.check("Group control has no inner focus outline", style.outlineStyle === "none")
                context.check(
                  "Group control has no inner border",
                  [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].every((width) =>
                    width === "0px"
                  ),
                )
                context.check(
                  "Group control has no inner focus ring",
                  !style.getPropertyValue("--tw-ring-shadow").trim() ||
                    style.getPropertyValue("--tw-ring-shadow").trim() === "0 0 #0000",
                )
              }
            },
            slider: (context) => {
              const horizontal = element<HTMLInputElement>(context.root, "[data-orientation=horizontal]")
              const vertical = element<HTMLInputElement>(context.root, "[data-orientation=vertical]")
              context.check(
                "Horizontal slider has a horizontal track",
                horizontal.getBoundingClientRect().width > horizontal.getBoundingClientRect().height,
              )
              context.check(
                "Vertical slider has a vertical track",
                vertical.getBoundingClientRect().height > vertical.getBoundingClientRect().width &&
                  getComputedStyle(vertical).writingMode === "vertical-lr",
              )
              const marked = element<HTMLInputElement>(context.root, "input[list]")
              context.check(
                "Slider uses datalist markers",
                Array.from(marked.list?.options ?? [], (option) => option.value).join(",") === "0,25,50,75,100",
              )
              const verticalMarked = element<HTMLInputElement>(context.root, "#vertical-markers-demo")
              context.check(
                "Vertical slider uses markers from high to low",
                Array.from(verticalMarked.list?.options ?? [], (option) => option.value).join(",") === "100,75,50,25,0",
              )
              context.check(
                "Vertical tracks align",
                vertical.getBoundingClientRect().top === verticalMarked.getBoundingClientRect().top &&
                  vertical.getBoundingClientRect().bottom === verticalMarked.getBoundingClientRect().bottom,
              )
              const horizontalRect = horizontal.getBoundingClientRect()
              const markedRect = marked.getBoundingClientRect()
              const verticalRect = vertical.getBoundingClientRect()
              const verticalMarkedRect = verticalMarked.getBoundingClientRect()
              context.check(
                "Horizontal and vertical sliders have equal spacing",
                Math.abs(
                  (markedRect.top + markedRect.height / 2 - horizontalRect.top - horizontalRect.height / 2)
                    - (verticalMarkedRect.left + verticalMarkedRect.width / 2 - verticalRect.left - verticalRect.width / 2),
                ) < 1,
              )
            },
            dialog: modal,
            "alert-dialog": modal,
            sheet: (context) => {
              modal(context)
              const sheet = element<HTMLDialogElement>(context.root, "dialog")
              const trigger = element<HTMLButtonElement>(context.root, "button[command=show-modal]")
              trigger.click()
              const bounds = sheet.getBoundingClientRect()
              const inside = { clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 }
              const outside = {
                clientX: bounds.left > 1 ? bounds.left - 1 : bounds.right + 1,
                clientY: bounds.top + bounds.height / 2,
              }
              sheet.dispatchEvent(new PointerEvent("pointerdown", inside))
              sheet.dispatchEvent(new MouseEvent("click", { ...outside, bubbles: true }))
              context.check("Dragging from sheet content does not dismiss it", sheet.open)
              sheet.dispatchEvent(new PointerEvent("pointerdown", { ...outside, button: 2 }))
              sheet.dispatchEvent(new MouseEvent("click", { ...outside, button: 2 }))
              context.check("Outside right-click keeps sheet open", sheet.open)
              sheet.dispatchEvent(new PointerEvent("pointerdown", outside))
              sheet.dispatchEvent(new PointerEvent("pointercancel", outside))
              sheet.dispatchEvent(new MouseEvent("click", outside))
              context.check("Canceled outside gesture keeps sheet open", sheet.open)
              const scroll = scrollY
              sheet.dispatchEvent(new PointerEvent("pointerdown", outside))
              sheet.dispatchEvent(new MouseEvent("click", { ...outside, bubbles: true }))
              context.check("Outside click dismisses sheet", !sheet.open)
              context.check("Outside dismissal preserves scroll", scrollY === scroll)
              if (sheet.open) sheet.close()
            },
            drawer: (context) => {
              modal(context)
              const drawer = element<HTMLDialogElement>(context.root, "dialog")
              const trigger = element<HTMLButtonElement>(context.root, "button[command=show-modal]")
              const handle = element<HTMLButtonElement>(drawer, "[data-slot=Drawer_handle]")
              trigger.click()
              context.check("Drawer handle has no focus outline", getComputedStyle(handle).outlineStyle === "none")
              handle.click()
              context.check("Handle activation dismisses the drawer", !drawer.open)
              const capture = Object.getOwnPropertyDescriptor(handle, "setPointerCapture")
              const release = Object.getOwnPropertyDescriptor(handle, "releasePointerCapture")
              // Synthetic pointers cannot capture a real pointer; native gestures are checked by browser automation.
              handle.setPointerCapture = () => {}
              handle.releasePointerCapture = () => {}
              try {
                for (
                  const gesture of [{ distance: 30, type: "pointerup" }, { distance: 100, type: "pointercancel" }, {
                    distance: 100,
                    type: "pointerup",
                  }]
                ) {
                  if (!drawer.open) trigger.click()
                  const transform = drawer.style.transform
                  handle.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, isPrimary: true, clientY: 20 }))
                  handle.dispatchEvent(
                    new PointerEvent("pointermove", { pointerId: 1, isPrimary: true, clientY: 20 + gesture.distance }),
                  )
                  context.check(
                    "Dragging moves the drawer downward",
                    drawer.style.transform === `translateY(${gesture.distance}px)`,
                  )
                  handle.dispatchEvent(
                    new PointerEvent(gesture.type, { pointerId: 1, isPrimary: true, clientY: 20 + gesture.distance }),
                  )
                  context.check("Gesture restores drawer position", drawer.style.transform === transform)
                  context.check(
                    gesture.type === "pointercancel"
                      ? "Canceled drag keeps drawer open"
                      : gesture.distance < 80
                      ? "Short drag keeps drawer open"
                      : "Downward drag dismisses drawer",
                    drawer.open === (gesture.type === "pointercancel" || gesture.distance < 80),
                  )
                }
              } finally {
                if (capture) Object.defineProperty(handle, "setPointerCapture", capture)
                else Reflect.deleteProperty(handle, "setPointerCapture")
                if (release) Object.defineProperty(handle, "releasePointerCapture", release)
                else Reflect.deleteProperty(handle, "releasePointerCapture")
                if (drawer.open) drawer.close()
              }
            },
            popover: popovers,
            "dropdown-menu": popovers,
            menubar: popovers,
            "context-menu": async (context) => {
              const trigger = element<HTMLElement>(context.root, "[data-context-menu-target]")
              const menu = element<HTMLElement>(document, `#${CSS.escape(trigger.dataset.contextMenuTarget!)}`)
              const rect = trigger.getBoundingClientRect()
              for (const buttons of [0, 2]) {
                const event = new MouseEvent("contextmenu", {
                  bubbles: true,
                  cancelable: true,
                  buttons,
                  clientX: rect.left + 20,
                  clientY: rect.top + 20,
                })
                trigger.dispatchEvent(event)
                context.check("Context menu suppresses browser menu", event.defaultPrevented)
                if (buttons) {
                  context.check("Menu waits for opening gesture to end", !popoverOpen(menu))
                  trigger.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }))
                }
                context.check(`Context gesture (buttons=${buttons}) opens menu`, await until(() => popoverOpen(menu)))
                if (popoverOpen(menu)) menu.hidePopover()
              }
            },
            "hover-card": async (context) => {
              const card = element<HTMLElement>(context.root, "[popover=manual]")
              const trigger = element<HTMLElement>(document, `#${CSS.escape(card.dataset.trigger!)}`)
              focus(trigger)
              context.check("Focus opens hover card", await until(() => popoverOpen(card)))
              if (popoverOpen(card)) popoverGeometry(context, card, trigger)
              blur(trigger)
              context.check("Blur closes hover card", await until(() => !popoverOpen(card)))
            },
            tooltip: async (context) => {
              // Tooltip scroll listeners must finish handling the runner's scroll before focus starts its opening timer.
              await afterLayout()
              const tip = element<HTMLElement>(context.root, "[popover=manual]")
              const trigger = element<HTMLElement>(document, `#${CSS.escape(tip.dataset.trigger!)}`)
              focus(trigger)
              context.check("Focus opens tooltip", await until(() => popoverOpen(tip)))
              if (popoverOpen(tip)) popoverGeometry(context, tip, trigger)
              blur(trigger)
              context.check("Blur closes tooltip", await until(() => !popoverOpen(tip)))
            },
            tabs: (context) => tabs(context, element(context.root, "[data-slot=Tabs]")),
            accordion: (context) => {
              const details = Array.from(context.root.querySelectorAll<HTMLDetailsElement>("details"))
              context.check("Accordion has multiple sections", details.length >= 2)
              for (const item of details) {
                element<HTMLElement>(item, "summary").click()
                context.check("Summary opens accordion content", item.open)
                context.check("Named accordion keeps one section open", details.filter((item) => item.open).length === 1)
              }
            },
            collapsible: (context) => {
              const details = element<HTMLDetailsElement>(context.root, "details")
              const summary = element<HTMLElement>(details, "summary")
              const height = context.root.getBoundingClientRect().height
              summary.click()
              context.check(
                "Summary reveals content",
                details.open && visible(element(details, ":scope > div")),
              )
              context.check("Expanded preview keeps its height", context.root.getBoundingClientRect().height === height)
              summary.click()
              context.check("Second activation hides content", !details.open)
              context.check("Collapsed preview keeps its height", context.root.getBoundingClientRect().height === height)
            },
            pagination: (context) => {
              const pagination = element<HTMLElement>(context.root, "[data-slot=Pagination]")
              const current = pagination.querySelectorAll("[aria-current=page]")
              context.check("Exactly one page is current", current.length === 1)
              const page = Number(current[0]?.textContent)
              const items = pagination.querySelectorAll("li > *")
              const previous = items[0]!
              const next = items[items.length - 1]!
              context.check(
                "Previous links to the preceding page or is disabled at the start",
                page === 1
                  ? previous.getAttribute("aria-disabled") === "true" && !previous.hasAttribute("href")
                  : previous.getAttribute("href") === `?page=${page - 1}#pagination`,
              )
              context.check(
                "Next links to the following page or is disabled at the end",
                page === 10
                  ? next.getAttribute("aria-disabled") === "true" && !next.hasAttribute("href")
                  : next.getAttribute("href") === `?page=${page + 1}#pagination`,
              )
            },
            resizable: (context) => {
              const handle = element<HTMLElement>(context.root, "[data-slot=Resizable_handle]")
              const panels = context.root.querySelectorAll<HTMLElement>("[data-slot=Resizable_panel]")
              const before = panels[0]!.getBoundingClientRect().width
              handle.focus({ preventScroll: true })
              key(handle, "ArrowRight")
              context.check("ArrowRight resizes panels", panels[0]!.getBoundingClientRect().width > before)
              for (let index = 0; index < 30; index++) key(handle, "ArrowLeft")
              const total = panels[0]!.offsetWidth + panels[1]!.offsetWidth
              context.check(
                "Resizing respects minimum sizes",
                panels[0]!.offsetWidth / total >= 0.19 && panels[1]!.offsetWidth / total >= 0.19,
              )
            },
            carousel: async (context) => {
              await afterLayout()
              const carousel = element<HTMLElement>(context.root, "[data-slot=Carousel]")
              const track = element<HTMLElement>(carousel, "[data-slot=Carousel_contentTrack]")
              const next = element<HTMLButtonElement>(carousel, "[data-slot=Carousel_next]")
              const previous = element<HTMLButtonElement>(carousel, "[data-slot=Carousel_previous]")
              context.check("Scrollbar is hidden", getComputedStyle(track).scrollbarWidth === "none")
              track.scrollTo({ left: 0, behavior: "instant" })
              context.check("Next is enabled before scrolling", await until(() => track.scrollLeft < 1 && !next.disabled))
              context.check("Previous is disabled at the start", await until(() => previous.disabled))
              next.click()
              context.check("Next scrolls to another slide", await until(() => track.scrollLeft > 10))
              await until(() => Math.abs(track.scrollLeft - track.clientWidth) < 1)
              context.check("Previous becomes available", !previous.disabled)
              key(carousel, "ArrowRight")
              context.check("ArrowRight advances carousel", await until(() => track.scrollLeft > track.clientWidth + 10))
              await until(() => Math.abs(track.scrollLeft - 2 * track.clientWidth) < 1)
              previous.click()
              context.check("Previous scrolls back", await until(() => track.scrollLeft < 2 * track.clientWidth - 10))
            },
            field: (context) => {
              const form = element<HTMLFormElement>(context.root, "form")
              const input = element<HTMLInputElement>(form, "#username-demo")
              input.value = ""
              context.check("Required field rejects empty value", !input.checkValidity())
              input.value = "tester"
              context.check("Valid value passes validation", input.checkValidity())
              form.requestSubmit()
              context.check(
                "Form submit runs demo handler",
                document.getElementById("demo-notifications")?.textContent === "Profile saved",
              )
            },
            label: (context) => {
              const label = element<HTMLLabelElement>(context.root, "label")
              label.click()
              context.check("Label focuses its associated control", label.control === document.activeElement)
            },
            progress: (context) => {
              const progress = element(context.root, "[role=progressbar]")
              const value = Number(progress.getAttribute("aria-valuenow"))
              context.check(
                "Progress exposes its value and bounds",
                value === 65 &&
                  progress.getAttribute("aria-valuemin") === "0" &&
                  progress.getAttribute("aria-valuemax") === "100",
              )
              const matrix = new DOMMatrix(getComputedStyle(element(progress, "[data-slot=Progress_indicator]")).transform)
              context.check(
                "Progress fill matches accessible value",
                Math.abs(matrix.m41 / progress.getBoundingClientRect().width + 0.35) < 0.02,
              )
            },
            toast: async (context) => {
              element<HTMLButtonElement>(context.root, "[data-show-toast]").click()
              const toast = await until(() => !!document.querySelector("[data-slot=Toast]"))
              context.check("Action creates toast", toast)
              if (!toast) return
              const node = element<HTMLElement>(document, "[data-slot=Toast]")
              context.check(
                "Toast is an accessible live region",
                node.getAttribute("role") === "status" && node.getAttribute("aria-live") === "polite",
              )
              context.check(
                "Toast becomes visible",
                await until(() => getComputedStyle(node).opacity === "1" && visible(node), 3600),
              )
              context.check("Toast dismisses after its duration", await until(() => !node.isConnected, 4600))
            },
          }

          const staticSelectors: Record<string, string> = {
            badge: "[data-slot=Badge]",
            card: "[data-slot=Card_header],[data-slot=Card_content],[data-slot=Card_footer]",
            avatar: "[data-slot=Avatar]",
            kbd: "kbd",
            "button-group": "[data-slot=ButtonGroup]",
            input: "input[type=email]",
            textarea: "textarea",
            "input-group": "[data-slot=InputGroup]",
            checkbox: "input[type=checkbox]",
            switch: "input[role=switch]",
            "radio-group": "[data-slot=RadioGroup]",
            slider: "input[type=range]",
            "native-select": "select optgroup",
            combobox: "input[list]",
            toggle: "[data-slot=Toggle]",
            "toggle-group": "[data-slot=ToggleGroup]",
            breadcrumb: "nav[aria-label=breadcrumb] [aria-current=page]",
            item: "[data-slot=Item]",
            table: "table thead th,table tbody td",
            empty: "[data-slot=Empty_title],[data-slot=Empty_description]",
            alert: "[role=alert]",
            spinner: "svg[role=status]",
          }

          async function testComponent(context: Context) {
            const surface = context.root
            context.check("Preview is rendered", visible(surface))
            context.check(
              "Preview fits page width",
              surface.getBoundingClientRect().right <= document.documentElement.clientWidth + 1,
            )
            const selector = staticSelectors[context.result.id]
            const scenario = scenarios[context.result.id]
            context.check("Component has a registered test", !!selector || !!scenario)
            if (selector) {
              context.check(
                "Expected component structure exists",
                selector.split(",").every((selector) => !!surface.querySelector(selector)),
              )
            }
            if (scenario) await scenario(context)
            controls(context)
            if (context.result.id === "avatar") {
              const images = Array.from(surface.querySelectorAll<HTMLImageElement>("img"))
              const badge = element<HTMLElement>(surface, "[data-slot=Avatar_badge]")
              const bounds = badge.getBoundingClientRect()
              context.check(
                "Avatar badge is fully visible at the edge",
                document.elementsFromPoint(bounds.right - 1, bounds.top + bounds.height / 2).some((node) => badge.contains(node)),
              )
              context.check(
                "Avatar image remains circular",
                images.every((image) => parseFloat(getComputedStyle(image).borderRadius) >= image.width / 2),
              )
              context.check(
                "Avatar images load",
                await until(() => images.every((image) => image.complete && image.naturalWidth > 0)),
              )
            }
            if (context.result.id === "spinner") {
              context.check(
                "Loading animation is configured",
                Array
                  .from(surface.querySelectorAll("svg"))
                  .some((node) => getComputedStyle(node).animationName !== "none"),
              )
            }
          }

          let running = false

          async function run(section: HTMLElement) {
            const result: Result = { id: section.id, checks: [], duration: 0 }
            const detail = element<HTMLDetailsElement>(section, "[data-test-result]")
            const summary = element<HTMLElement>(detail, "summary")
            const list = element<HTMLElement>(detail, "ul")
            const context: Context = {
              root: element<HTMLElement>(section, ".preview-surface"),
              result,
              check: (name, passed, detail) => result.checks.push({ name, passed, detail }),
            }
            if (
              document.querySelector("dialog[open]") || Array.from(document.querySelectorAll("[popover]")).some(popoverOpen)
            ) {
              detail.dataset.testState = "failed"
              summary.textContent = "Close open dialogs and popovers, then test again."
              list.replaceChildren()
              detail.open = true
              const link = element<HTMLAnchorElement>(section, "[data-test-link]")
              link.hidden = false
              link.textContent = "Results · blocked"
              result.checks.push({ name: "Close open dialogs and popovers before testing", passed: false })
              return result
            }
            const scroll = { x: scrollX, y: scrollY }
            const focused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
            const restore = saveState(section)
            const notifications = element<HTMLElement>(document, "#demo-notifications")
            const notificationText = notifications.textContent
            const notificationClass = notifications.className
            const existingToasts = new Set(document.querySelectorAll("[data-slot=Toast]"))
            const runtimeErrors: string[] = []
            const onError = (event: ErrorEvent) => runtimeErrors.push(event.message)
            const onRejection = (event: PromiseRejectionEvent) => runtimeErrors.push(String(event.reason))
            window.addEventListener("error", onError)
            window.addEventListener("unhandledrejection", onRejection)
            section.setAttribute("aria-busy", "true")
            const start = performance.now()
            try {
              resetFixture(section)
              context.root.scrollIntoView({ block: "center", behavior: "instant" })
              tabs(context, element<HTMLElement>(section, ":scope > [data-slot=Tabs]"))
              element<HTMLInputElement>(section, `input[name="preview-${section.id}"][value=preview]`).click()
              await testComponent(context)
            } catch (error) {
              context.check("Test executes without an exception", false, error instanceof Error ? error.message : String(error))
            } finally {
              for (const dialog of context.root.querySelectorAll<HTMLDialogElement>("dialog[open]")) dialog.close()
              for (const popover of context.root.querySelectorAll<HTMLElement>("[popover]")) {
                if (popoverOpen(popover)) popover.hidePopover()
              }
              if (document.activeElement instanceof HTMLElement) blur(document.activeElement)
              restore()
              for (const toast of document.querySelectorAll("[data-slot=Toast]")) {
                if (!existingToasts.has(toast)) toast.remove()
              }
              for (const toaster of document.querySelectorAll("[data-slot=Toaster]")) {
                if (!toaster.children.length) toaster.remove()
              }
              notifications.textContent = notificationText
              notifications.className = notificationClass
              window.scrollTo({ left: scroll.x, top: scroll.y, behavior: "instant" })
              focused?.focus({ preventScroll: true })
              window.removeEventListener("error", onError)
              window.removeEventListener("unhandledrejection", onRejection)
              context.check("No browser runtime errors", runtimeErrors.length === 0, runtimeErrors.join("; ") || undefined)
              result.duration = performance.now() - start
              section.removeAttribute("aria-busy")
            }
            const failed = result.checks.filter((check) => !check.passed).length
            detail.dataset.testState = failed ? "failed" : "passed"
            summary.textContent = `${failed ? "FAIL" : "PASS"} · ${
              result.checks.length - failed
            }/${result.checks.length} checks · ${Math.round(result.duration)}ms`
            list.replaceChildren(...result.checks.map((check) => {
              const item = document.createElement("li")
              item.textContent = `${check.passed ? "PASS" : "FAIL"} · ${check.name}${check.detail ? ` — ${check.detail}` : ""}`
              item.dataset.testState = check.passed ? "passed" : "failed"
              return item
            }))
            detail.open = true
            const link = element<HTMLAnchorElement>(section, "[data-test-link]")
            link.hidden = false
            link.textContent = `${failed ? "FAIL" : "PASS"} · Results`
            return result
          }

          document.addEventListener("click", async (event) => {
            const button = event.target instanceof Element
              ? event.target.closest<HTMLButtonElement>("[data-test-individual],[data-test-all]")
              : null
            if (!button || running) return
            running = true
            const controls = document.querySelectorAll<HTMLButtonElement>("[data-test-individual],[data-test-all]")
            for (const control of controls) control.disabled = true
            const all = button.hasAttribute("data-test-all")
            const sections = all
              ? Array.from(document.querySelectorAll<HTMLElement>("[data-doc-section]"))
              : [button.closest<HTMLElement>("[data-doc-section]")!]
            const start = performance.now()
            const results: Result[] = []
            button.textContent = "Testing…"
            try {
              for (const section of sections) {
                button.textContent = all ? `Testing ${results.length + 1}/${sections.length}…` : "Testing…"
                const result = await run(section)
                results.push(result)
                if (all) document.dispatchEvent(new CustomEvent("ui-test-complete", { detail: result }))
              }
              if (all) {
                const passed = results.filter((result) => result.checks.every((check) => check.passed)).length
                const summary = `${passed === results.length ? "PASS" : "FAIL"} · ${passed}/${results.length} components · ${
                  Math.round(performance.now() - start)
                }ms`
                const detail = element<HTMLElement>(document, "[data-test-all-result]")
                detail.dataset.testState = passed === results.length ? "passed" : "failed"
                element(detail, "[data-test-all-summary]").textContent = summary
                element(detail, "[data-test-all-list]").replaceChildren(...results.map((result) => {
                  const item = document.createElement("li")
                  const link = document.createElement("a")
                  link.href = `#test-result-${result.id}`
                  link.className = "underline"
                  link.textContent = `${result.checks.every((check) => check.passed) ? "PASS" : "FAIL"} · ${result.id} · ${
                    Math.round(result.duration)
                  }ms`
                  item.append(link)
                  return item
                }))
                const link = element<HTMLAnchorElement>(document, "[data-test-all-link]")
                link.hidden = false
                link.textContent = `${passed}/${results.length} · Results`
              }
            } finally {
              button.textContent = all ? "Test all" : "Test"
              for (const control of controls) control.disabled = false
              running = false
            }
            document.dispatchEvent(
              new CustomEvent(all ? "ui-tests-complete" : "ui-test-complete", {
                detail: all ? results : results[0],
              }),
            )
          })
          document.body.dataset.testReady = "true"
        }}
      </script>
    </>
  )
}))
