# Ask a question aloud

- **Status:** Draft


## Outcome

The owner asks Ask a question aloud and gets the same answer a typed question gets, from the same catalog and the same reads.

## Boundary

- `SYSTEM-SPEC.md` §10 lists voice as out of the MVP. Its selling narrative still names asking a question aloud and getting a real number.
- `/ask` takes typed questions only. The ask-your-data spec's Never do rules out voice input.
- A spoken question goes through the same eight catalog queries, the model's choice, the server's re-check, and the fixed sentences. Voice adds a way to ask, never a way to answer.
- Speech to text is a new data flow. The AI connection in `docs/architecture/overview.md` lists everything a question sends today, and audio is not on that list.

## Owner

- jaketlee07

## Unresolved questions

- Does the owner want voice after the MVP ships?
- Where does speech become text: the device's own dictation, which can already type into the question field, the browser's speech input, or a model service? What does each send off the machine?
- Does voice on a phone wait for `app-https-hosting.md`? Browsers give a page the microphone only over HTTPS or on the machine's own address.

## Projection

- A spec through new-spec once the owner schedules voice.


## Source

- Mode: repo-origin
- Locator: docs/specs/ask-your-data/spec.md
- Revision: 9e90129
- Authority: repo-origin
