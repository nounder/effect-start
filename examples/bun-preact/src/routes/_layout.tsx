export default function(props) {
  return (
    <div>
      <h1>
        Root layout
      </h1>

      <div>
        {props.children}
      </div>
    </div>
  )
}
