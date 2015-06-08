# Crabtrap Proxy

Crabtrap is a capturing/replaying proxy originally developed to help with testing web crawlers in the [Crabfarm](www.crabfarm.io) proyect.

Features:

* Records https requests (using an invalid certificate).
* Uses a combination of request ordering and partial url/content matching when replaying.
* Allows serving assets in a virtual domain (www.crabtrap.io).

## Usage:

To record every passing requests:

```
crabtrap capture path/to/somefile
```

To replay recorded requests (other requests will produce a 404 response)

```
crabtrap replay path/to/capture/file
```

To get more help on usage use

```
crabtrap -h
```