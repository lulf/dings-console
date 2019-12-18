FROM fedora-minimal:latest

ADD build/console /
ADD public /webapp

ENTRYPOINT ["/console", "-d", "/webapp"]
