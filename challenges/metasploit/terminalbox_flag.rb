class MetasploitModule < Msf::Auxiliary
  include Msf::Exploit::Remote::HttpClient
  include Msf::Auxiliary::Scanner

  def initialize(info = {})
    super(update_info(info,
      'Name' => 'TerminalBox Training Flag Scanner',
      'Description' => %q{Queries the isolated TerminalBox training target.},
      'Author' => ['TerminalBox'],
      'License' => MSF_LICENSE
    ))
    register_options([Opt::RPORT(3100), OptString.new('TARGETURI', [true, 'Status path', '/metasploit/status'])])
  end

  def run_host(_ip)
    response = send_request_cgi(
      'method' => 'GET',
      'uri' => normalize_uri(target_uri.path),
      'headers' => { 'X-TerminalBox-Msf' => 'auxiliary-scan' }
    )
    fail_with(Failure::Unreachable, 'No response from target') unless response
    if response.code == 200 && response.body.include?('TBX{')
      print_good("TerminalBox target: #{response.body}")
    else
      print_error("Unexpected response: HTTP #{response.code}")
    end
  end
end
