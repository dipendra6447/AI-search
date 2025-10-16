import { useState } from 'react'
import { useEffect } from 'react'
export default function Answers({ ans }) {
  const [heading, setHeading] = useState(false);
  useEffect(() => {
    if (checkHeading(ans)) {
      console.log(setHeading(true))

    }
  }, []);
  function checkHeading(Are) {
    return /^(\*)(\*)(.*)\*$/.test(Are);
  }
  return (

    <>
      {heading ? <h2 className='text-2xl font-bold mt-5'>{ans.replace(/\*\*/g, '')}</h2> : ans}
    </>
  )
}