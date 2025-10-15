import React from "react";

const internals = (React as unknown as {
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: { A?: { getOwner?: () => unknown } }
}).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

if (internals?.A && typeof internals.A.getOwner !== "function") {
  internals.A.getOwner = () => null;
}