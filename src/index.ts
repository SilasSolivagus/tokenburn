#!/usr/bin/env node
import { Command } from 'commander'

const program = new Command()

program
  .name('tokenburn')
  .description('htop for your AI spending')
  .version('0.1.0')

program.parse()
