---
"@nmi-agro/fdm-helpdesk": minor
---

Helpdesk agents can now create and make use of saved replies using a new set of saved reply CRUD functions. There is also `makeSavedReplyBodySimple` which let agents extract a message body with template syntax, given a set of placeholders and the values assumed for them in the source text. There is also `applySavedReply` which can take the template text and fill in the template syntax with the values in the given context object.
