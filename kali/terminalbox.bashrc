export PS1='\[\e[1;32m\]student@kali\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ '
__terminalbox_prompt_newline() {
  local row column
  IFS=';' read -r -s -d R -t 0.15 -p $'\e[6n' row column || return 0
  column=${column:-1}
  (( column > 1 )) && printf '\n'
}
export PROMPT_COMMAND=__terminalbox_prompt_newline
export HISTFILE=/home/student/.bash_history
alias ll='ls -alF'
