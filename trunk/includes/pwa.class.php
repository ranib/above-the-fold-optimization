<?php

/**
 * Google PWA optimization functions and hooks.
 *
 * This class provides the functionality for Google PWA optimization functions and hooks.
 *
 * @since      2.8.3
 * @package    abovethefold
 * @subpackage abovethefold/includes
 * @author     PageSpeed.pro <info@pagespeed.pro>
 */


class Abovethefold_PWA
{

    /**
     * Above the fold controller
     */
    public $CTRL;

    /**
     * Initialize the class and set its properties
     */
    public function __construct(&$CTRL)
    {
        $this->CTRL =& $CTRL;

        if ($this->CTRL->disabled) {
            return; // above the fold optimization disabled for area / page
        }
    }

    /**
     * Return service worker path and scope
     */
    public function get_sw()
    {
        $path = trailingslashit(ABSPATH);
        $scope = trailingslashit(parse_url(site_url(), PHP_URL_PATH));

        $sw_filename = 'abtf-pwa.js';
        $sw_filename_debug = 'abtf-pwa.debug.js';
        $sw_policy_filename = 'abtf-pwa-config.json';

        return array(
            'filename' => $sw_filename,
            'filename_debug' => $sw_filename_debug,
            'file' => $path . $sw_filename,
            'file_debug' => $path . $sw_filename_debug,
            'file_policy' => $path . $sw_policy_filename,
            'scope' => $scope
        );
    }

    /**
     * Get Service Worker config
     */
    public function get_sw_config()
    {
        $cache_policy = array();

        // asset cache
        if (isset($this->CTRL->options['pwa_cache_assets']) && $this->CTRL->options['pwa_cache_assets'] && is_array($this->CTRL->options['pwa_cache_assets_policy'])) {
            $cache_policy = $this->CTRL->options['pwa_cache_assets_policy'];
        } else {
            $cache_policy = array(); // $this->get_sw_default_policy();
        }

        // page cache
        if (isset($this->CTRL->options['pwa_cache_pages']) && $this->CTRL->options['pwa_cache_pages']) {

            // create page cache policy
            $page_cache_policy = array(
                'title' => 'Match pages',
                'match' => array(
                    array( 'type' => 'header', 'name' => 'Accept', 'pattern' => 'text/html')
                ),
                'strategy' => $this->CTRL->options['pwa_cache_pages_strategy'],
                'cache' => array(
                    'conditions' => array(
                        array(
                            'type' => 'header',
                            'name' => 'content-type',
                            'pattern' => 'text/html'
                        )
                    )
                )
            );

            // add URL match based on include list
            if (isset($this->CTRL->options['pwa_cache_pages_include']) && $this->CTRL->options['pwa_cache_pages_include']) {
                $page_cache_policy['match'][] = array(
                    'type' => 'url', 'pattern' => $this->CTRL->options['pwa_cache_pages_include']
                );
            }

            // offline page
            if (isset($this->CTRL->options['pwa_cache_pages_offline']) && $this->CTRL->options['pwa_cache_pages_offline']) {
                $page_cache_policy['offline'] = $this->CTRL->options['pwa_cache_pages_offline'];
            }

            // cache strategy
            if ($this->CTRL->options['pwa_cache_pages_strategy'] === 'cache') {
                if (!isset($page_cache_policy['cache'])) {
                    $page_cache_policy['cache'] = array();
                }

                if (isset($this->CTRL->options['pwa_cache_pages_update_interval']) && $this->CTRL->options['pwa_cache_pages_update_interval']) {
                    $page_cache_policy['cache']['update_interval'] = intval($this->CTRL->options['pwa_cache_pages_update_interval']);
                }
                if (isset($this->CTRL->options['pwa_cache_pages_max_age']) && $this->CTRL->options['pwa_cache_pages_max_age']) {
                    $page_cache_policy['cache']['max_age'] = intval($this->CTRL->options['pwa_cache_pages_max_age']);
                }
                $page_cache_policy['cache']['head_update'] = (isset($this->CTRL->options['pwa_cache_pages_head_update']) && $this->CTRL->options['pwa_cache_pages_head_update']) ? true : false;

                $page_cache_policy['cache']['notify'] = (isset($this->CTRL->options['pwa_cache_pages_update_notify']) && $this->CTRL->options['pwa_cache_pages_update_notify']) ? true : false;
            }

            $cache_policy[] = $page_cache_policy;
        }

        $config = array(
            'policy' => $cache_policy
        );

        // preload assets
        if (isset($this->CTRL->options['pwa_cache_preload']) && $this->CTRL->options['pwa_cache_preload']) {
            $config['preload'] = $this->CTRL->options['pwa_cache_preload'];
        }

        if (isset($this->CTRL->options['pwa_manifest_start_url']) && $this->CTRL->options['pwa_manifest_start_url']) {
            $config['start_url'] = $this->CTRL->options['pwa_manifest_start_url'];
        }

        return $config;
    }

    /**
     * Update Service Worker file
     */
    public function update_sw()
    {
        $sw_ok = false;
        $sw = $this->get_sw();
        $sources = array(
            'pwa-serviceworker.js' => $sw['file'],
            'pwa-serviceworker.debug.js' => $sw['file_debug']
        );
        foreach ($sources as $sourcefile => $sw_path) {
            $source = trailingslashit(WPABTF_PATH) . 'public/js/' . $sourcefile;
            if (!file_exists($source)) {
                $this->CTRL->admin->set_notice('The service worker source file (above-the-fold-optimization/public/js/'.$sourcefile.') is missing.', 'ERROR');
            } else {
                $sw_ok = true;
                if (!file_exists($sw_path) || md5_file($source) !== md5_file($sw_path)) {
                    try {
                        @file_put_contents($sw_path, file_get_contents($source));
                    } catch (Exception $error) {
                        $sw_ok = false;
                    }
                    if (!file_exists($sw_path)) {
                        $sw_ok = false;
                    } elseif ($sw_ok && md5_file($source) !== md5_file($sw_path)) {
                        $sw_ok = false;
                    }
                }

                if (!$sw_ok) {
                    if (isset($this->CTRL->admin)) {
                        $this->CTRL->admin->set_notice('Failed to install the Service Worker on <strong>' . esc_html(str_replace(ABSPATH, '[ABSPATH]/', $sw_path)) . '</strong>. Please check the permissions or copy the file manually from ' . esc_html(str_replace(ABSPATH, '[ABSPATH]/', trailingslashit(WPABTF_PATH) . 'public/js/'.$sourcefile)) . ' (<a href="' . esc_attr(trailingslashit(WPABTF_URI) . 'public/js/'.$sourcefile) . '" download="'.$sourcefile.'">download</a>).', 'ERROR');
                    }
                }
            }
        }

        if (!$sw_ok) {
            return false;
        }
        
        return true;
    }

    /**
     * Update Service Worker config
     */
    public function update_sw_config()
    {
        $sw = $this->get_sw();
        $config = $this->get_sw_config();
        $config_json = json_encode($config);

        $sw_policy_ok = true;
        $current_config = (file_exists($sw['file_policy'])) ? file_get_contents($sw['file_policy']) : false;
        if (!$current_config || md5($current_config) !== md5($config_json)) {
            try {
                @file_put_contents($sw['file_policy'], $config_json);
            } catch (Exception $error) {
                $sw_policy_ok = false;
            }
            if (!file_exists($sw['file_policy'])) {
                $sw_policy_ok = false;
            } elseif ($sw_policy_ok && md5(file_get_contents($sw['file_policy'])) !== md5($config_json)) {
                $sw_policy_ok = false;
            }
        }

        if (!$sw_policy_ok) {
            return false;
        }
        
        return true;
    }

    /**
     * Return default asset cache policy
     */
    public function get_sw_default_policy()
    {

        // default cache policy
        return array(
            array(
                'title' => 'Match images',
                'match' => array(
                    array(
                        'type' => 'header',
                        'name' => 'Accept',
                        'pattern' => 'image/'
                    ),
                    array(
                        'not' => true,
                        'type' => 'header',
                        'name' => 'Accept',
                        'pattern' => 'text/html'
                    ),
                    array(
                        "not" => true,
                        "type" => "url",
                        "pattern" => "google-analytics.com/collect"
                    )
                ),
                'strategy' => 'cache',
                'cache' => array(
                    'update_interval' => 3600,
                    'head_update' => true,
                    'conditions' => array(
                        array(
                            'type' => 'header',
                            'name' => 'content-length',
                            'pattern' => array( 'operator' => '<',  'value' => 35840 )
                        )
                    )
                ),
                'offline' => '/path/to/offline.png'
            ),
            array(
                'title' => 'Match assets',
                'match' => array(
                    array(
                        'type' => 'url',
                        'pattern' => '/\.(css|js|woff|woff2|ttf|otf|eot)(\?.*)?$/i',
                        'regex' => true
                    )
                ),
                'strategy' => 'cache',
                'cache' => array(
                    'update_interval' => 300,
                    'head_update' => true,
                    'max_age' => 86400
                )
            )
        );
    }


    /**
     * Javascript client settings
     */
    public function client_jssettings(&$jssettings, &$jsfiles, &$inlineJS, $jsdebug, &$html_before)
    {

        // print link to manifest.json
        if (isset($this->CTRL->options['pwa_manifest_meta']) && $this->CTRL->options['pwa_manifest_meta']) {
            $html_before .= '<link rel="manifest" href="' . esc_attr(site_url('manifest.json')) . '">';
        }

        // print Web App meta
        if (isset($this->CTRL->options['pwa_meta']) && $this->CTRL->options['pwa_meta']) {
            $html_before .= $this->CTRL->options['pwa_meta'];
        }

        // PWA client
        if (!isset($this->CTRL->options['pwa']) || !$this->CTRL->options['pwa']) {
            if (isset($this->CTRL->options['pwa_unregister']) && $this->CTRL->options['pwa_unregister']) {

                // unregister
                $jssettings[$this->CTRL->optimization->client_config_ref['pwa_unregister']] = true;
                $jsfiles[] = WPABTF_PATH . 'public/js/abovethefold-pwa-unregister'.$jsdebug.'.min.js';
            }

            // disabled
            return;
        }
        // verify if service worker exists
        $sw = $this->get_sw();

        $swfile = ($jsdebug) ? $sw['filename_debug'] : $sw['filename'];
        if (!file_exists($swfile)) {

            // debug file missing, fallback to regular
            if ($jsdebug && file_exists($sw['filename'])) {
                $swfile = $sw['filename'];
            } else {
                // disable
                return;
            }
        }

        // no cache policy file
        if (!file_exists($sw['file_policy'])) {
            // disable
            return;
        }

        $pwaindex = $this->CTRL->optimization->client_config_ref['pwa'];

        if (isset($this->CTRL->options['pwa_scope']) && trim($this->CTRL->options['pwa_scope']) !== '') {
            $scope = $this->CTRL->options['pwa_scope'];
        } else {
            $scope = $sw['scope'];
        }

        $pwasettings = array(
            'path' => $sw['scope'] . $swfile,
            'scope' => $scope,
            'policy' => filemtime($sw['file_policy']),
            'register' => (!isset($this->CTRL->options['pwa_register']) || $this->CTRL->options['pwa_register'])
        );

        // offline class
        if (isset($this->CTRL->options['pwa_offline_class']) && $this->CTRL->options['pwa_offline_class']) {
            $pwasettings['offline_class'] = true;
        }

        // version
        if (isset($this->CTRL->options['pwa_cache_version']) && $this->CTRL->options['pwa_cache_version'] !== '') {
            $pwasettings['version'] = $this->CTRL->options['pwa_cache_version'];
        } else {
            $pwasettings['version'] = '';
        }

        // version
        if (isset($this->CTRL->options['pwa_cache_max_size']) && $this->CTRL->options['pwa_cache_max_size'] !== '') {
            $pwasettings['max_size'] = $this->CTRL->options['pwa_cache_max_size'];
        } else {
            $pwasettings['max_size'] = '';
        }

        $jssettings[$pwaindex] = array();
        foreach ($pwasettings as $key => $value) {
            if (!isset($this->CTRL->optimization->client_config_ref['pwa-sub'][$key])) {
                continue;
            }

            $jssettings[$pwaindex][$this->CTRL->optimization->client_config_ref['pwa-sub'][$key]] = $value;
        }

        $max = 0;
        foreach ($jssettings[$pwaindex] as $index => $value) {
            if ($index > $max) {
                $max = $index;
            }
        }
        if ($max > 0) {
            for ($i = 0; $i <= $max; $i++) {
                if (!isset($jssettings[$pwaindex][$i])) {
                    $jssettings[$pwaindex][$i] = -1;
                }
            }
            ksort($jssettings[$pwaindex]);
        }

        $jsfiles[] = WPABTF_PATH . 'public/js/abovethefold-pwa'.$jsdebug.'.min.js';
    }
}
