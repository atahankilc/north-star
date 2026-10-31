#!/bin/zsh
# Every flow, dark then light, one at a time (the machine is shared; two at once starve each other), each one's output in
# $OUT/<flow>-<theme>.txt and a line per run in $OUT/runs.txt. Needs PUPPETEER_CORE, the dev server (BASE) and the
# emulators (FS_PORT); see lib.mjs. FLOWS="new viewer" limits it; THEMES="dark" too.
#   OUT=/tmp/o16 PUPPETEER_CORE=… FS_PORT=8280 zsh docs/specs/onboarding-shots/flows/run-all.sh
here=${0:A:h}
OUT=${OUT:-/tmp/onboarding-flows}
mkdir -p $OUT
for flow in ${=FLOWS:-new more invited viewer release tipsoff nudges join guide}; do
  for theme in ${=THEMES:-dark light}; do
    perl -e 'alarm 1800; exec @ARGV' node $here/$flow.mjs $theme > $OUT/$flow-$theme.txt 2>&1
    code=$?
    echo "$flow $theme exit $code $(grep '^SUMMARY' $OUT/$flow-$theme.txt)" | tee -a $OUT/runs.txt
  done
done
