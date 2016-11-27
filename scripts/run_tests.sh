#!/bin/bash

# Store the butts stdout in a file so we can verify whether it's printed anything
buttsstdout=$(mktemp /tmp/butts_XXXXX)
# Cleanup the tempfile on exit
trap "rm -f \"${buttsstdout}\"" EXIT

# Print ./start_server.sh's output to our stdout and the file at the same time so the user can see the output...
./scripts/start_server.sh | tee "${buttsstdout}" &
# If we didn't want the user to see our output, we could use './buttsscript.sh & > "${buttsstdout}"' instead

# Maximum wait of 30s (300 .1s pauses)
attempts=300

# -s is the 'test' for a nonempty file, see 'man 1 test' for the details
until [[ $(grep connected "${buttsstdout}") ]]; do
  sleep 0.1
  if [[ "${attempts}" == "0" ]]; then
    echo "No stdout in time"
    exit 1
  fi
  attempts=$((attempts-1))
done

echo "Detected server is ready.  Starting tests."
/usr/local/bin/phantomjs --web-security=false ./test/runner-list.js ./test/fixture.html