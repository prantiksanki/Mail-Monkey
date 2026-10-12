# These reference resources that already exist and were NOT created for
# this project (the account's default VPC). We read them, we don't manage
# or import them - Terraform should never have the ability to destroy the
# default VPC.

data "aws_vpc" "default" {
  id = "vpc-0e1b0f9d4e9d35cc3"
}

data "aws_subnet" "a" {
  id = "subnet-0429cb8434b535083"
}

data "aws_subnet" "b" {
  id = "subnet-03a44220684ecf72f"
}

data "aws_subnet" "c" {
  id = "subnet-0e29c12089dddc395"
}

data "aws_security_group" "default" {
  id = "sg-01b29cddb8c82b3e3"
}

locals {
  subnet_ids = [
    data.aws_subnet.a.id,
    data.aws_subnet.b.id,
    data.aws_subnet.c.id,
  ]
}
