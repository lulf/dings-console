/*
 * Copyright 2019, Ulf Lilleengen
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"net/http"
)

func main() {
	var httpRoot string
	flag.StringVar(&httpRoot, "d", "/web", "Path to webroot")
	flag.Usage = func() {
		fmt.Printf("Usage of %s:\n", os.Args[0])
		fmt.Printf("    [-d webroot\n")
	}
	flag.Parse()
	fs := http.FileServer(http.Dir(httpRoot))
	http.Handle("/", fs)
	log.Println("Console started")
	http.ListenAndServe(":8080", nil)
}
