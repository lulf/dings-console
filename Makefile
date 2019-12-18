all: build 

container_build: build
	podman build -t console:latest .

build: builddir
	GOOS=linux GOARCH=amd64 go build -o build/console cmd/console/main.go
	npm install

test:
	go test -v ./...

builddir:
	mkdir -p build

clean:
	rm -rf build
