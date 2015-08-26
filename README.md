# Crabtrap Proxy

Crabtrap is an http proxy that can capture and replay requests.

It was originally developed to help with testing web crawlers in the [Crabfarm](http://www.crabfarm.io) project.

Features:

* Records SSL requests (using a self signed certificate).
* When in replay mode, it uses smart url/content matching to serve the proper response.
* Allows serving assets in a local folder at the crabtrap.io mock domain.

## Usage:

To record every passing requests, first start the proxy:

```
crabtrap capture ./somefile
```

then configure your browser's proxy to use `localhost:4000` and navigate.

When you are done, terminate the proxy process with Ctrl-C or TERM signal

To start replay mode use:

```
crabtrap replay ./somefile
```

The proxy will use the capture file to respond recorded requests (other requests will produce a 404 response)

To get more help on usage use

```
crabtrap -h
```

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

## Credits

Thank you [contributors](https://github.com/platanus/crabtrap/graphs/contributors)!

<img src="https://cloud.githubusercontent.com/assets/313750/9365675/3409359a-4689-11e5-86b0-3921819c51f8.png" alt="Crabfarm" width="250"/>

Crabtrap is part of the [Crabfarm Framework](http://crabfarm.io/code).

## License

Crabtrap is © 2015 [Platanus, spa](http://platan.us). It is free software and may be redistributed under the MIT License.